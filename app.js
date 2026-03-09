const KEY = "link_stack_items_v1";
const CFG_KEY = "link_stack_supabase_cfg_v1";
const TABLE = "links";

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function normalizeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

function loadCfg() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCfg(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

function hasCloud() {
  const cfg = loadCfg();
  return Boolean(cfg.url && cfg.anonKey);
}

function cloudHeaders() {
  const cfg = loadCfg();
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    "Content-Type": "application/json",
  };
}

function cloudBase() {
  const cfg = loadCfg();
  return `${cfg.url.replace(/\/+$/, "")}/rest/v1/${TABLE}`;
}

async function fetchCloudItems() {
  const qs = "?select=id,url,note,source,status,created_at&order=created_at.desc";
  const resp = await fetch(cloudBase() + qs, { headers: cloudHeaders() });
  if (!resp.ok) throw new Error(`cloud_fetch_failed_${resp.status}`);
  const rows = await resp.json();
  return rows.map((r) => ({
    id: r.id || uuid(),
    ts: r.created_at || nowIso(),
    source: r.source || "cloud",
    type: "url",
    url: r.url,
    note: r.note || "",
    status: r.status || "pending",
  }));
}

async function insertCloudItem(item) {
  const payload = {
    url: item.url,
    note: item.note,
    source: item.source,
    status: item.status,
    created_at: item.ts,
  };
  const resp = await fetch(cloudBase(), {
    method: "POST",
    headers: { ...cloudHeaders(), Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`cloud_insert_failed_${resp.status}`);
}

async function deleteCloudItem(item) {
  const key = item.id ? `id=eq.${encodeURIComponent(item.id)}` : `url=eq.${encodeURIComponent(item.url)}`;
  const resp = await fetch(cloudBase() + "?" + key, { method: "DELETE", headers: cloudHeaders() });
  if (!resp.ok) throw new Error(`cloud_delete_failed_${resp.status}`);
}

async function clearCloudItems() {
  const resp = await fetch(cloudBase() + "?id=not.is.null", { method: "DELETE", headers: cloudHeaders() });
  if (!resp.ok) throw new Error(`cloud_clear_failed_${resp.status}`);
}

async function addItem(url, note = "", source = "manual") {
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: false, reason: "invalid_url" };

  const items = loadItems();
  if (items.some((x) => x.url === normalized)) {
    return { ok: false, reason: "duplicate" };
  }

  const item = {
    id: uuid(),
    ts: nowIso(),
    source,
    type: "url",
    url: normalized,
    note: note.trim(),
    status: "pending",
  };
  if (hasCloud()) {
    await insertCloudItem(item);
    const next = await fetchCloudItems();
    saveItems(next);
  } else {
    items.unshift(item);
    saveItems(items);
  }
  return { ok: true, item };
}

function updateSyncBadge() {
  const badge = document.getElementById("sync-status");
  if (!badge) return;
  badge.textContent = hasCloud() ? "Cloud (Supabase)" : "Local only";
}

function render() {
  const list = document.getElementById("list");
  const count = document.getElementById("count");
  const items = loadItems();
  count.textContent = String(items.length);
  list.innerHTML = "";

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "item";

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.url;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.ts} | ${item.source}${item.note ? ` | ${item.note}` : ""}`;

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "删除";
    del.onclick = async () => {
      if (hasCloud()) {
        try {
          await deleteCloudItem(item);
          const next = await fetchCloudItems();
          saveItems(next);
        } catch (e) {
          alert(`云端删除失败: ${String(e)}`);
        }
      } else {
        const next = loadItems().filter((x) => x.id !== item.id);
        saveItems(next);
      }
      render();
    };

    li.appendChild(link);
    li.appendChild(meta);
    li.appendChild(del);
    list.appendChild(li);
  }
}

function exportNdjson() {
  const lines = loadItems().map((x) => JSON.stringify(x));
  const blob = new Blob([lines.join("\n")], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `link-stack-${new Date().toISOString().slice(0, 10)}.ndjson`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importNdjson(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  let n = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.url) {
        const r = await addItem(obj.url, obj.note || "", obj.source || "import");
        if (r.ok) n += 1;
      }
    } catch {
      // ignore bad line
    }
  }
  alert(`导入完成，新增 ${n} 条`);
  render();
}

async function handleShareTargetParams() {
  const q = new URLSearchParams(location.search);
  const title = q.get("title") || "";
  const text = q.get("text") || "";
  const url = q.get("url") || "";
  const candidates = [url, ...text.split(/\s+/), ...title.split(/\s+/)];

  let added = 0;
  for (const c of candidates) {
    if (!c.startsWith("http://") && !c.startsWith("https://")) continue;
    const r = await addItem(c, "shared", "share_target");
    if (r.ok) added += 1;
  }
  if (added > 0) {
    history.replaceState({}, "", location.pathname);
    alert(`已从分享接收 ${added} 条链接`);
  }
}

async function refreshFromCloudIfNeeded() {
  if (!hasCloud()) return;
  try {
    const items = await fetchCloudItems();
    saveItems(items);
  } catch (e) {
    alert(`云端读取失败，回退本地: ${String(e)}`);
  }
}

function bind() {
  const form = document.getElementById("add-form");
  const exportBtn = document.getElementById("export-btn");
  const importInput = document.getElementById("import-file");
  const clearBtn = document.getElementById("clear-btn");
  const cfgForm = document.getElementById("cfg-form");
  const cfgUrl = document.getElementById("cfg-url");
  const cfgKey = document.getElementById("cfg-key");
  const cloudPullBtn = document.getElementById("cloud-pull-btn");
  const cloudOffBtn = document.getElementById("cloud-off-btn");

  const cfg = loadCfg();
  if (cfgUrl) cfgUrl.value = cfg.url || "";
  if (cfgKey) cfgKey.value = cfg.anonKey || "";
  updateSyncBadge();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("url").value;
    const note = document.getElementById("note").value;
    const r = await addItem(url, note, "manual");
    if (!r.ok && r.reason === "duplicate") {
      alert("重复链接，已忽略");
      return;
    }
    if (!r.ok) {
      alert("链接格式不正确");
      return;
    }
    form.reset();
    render();
  });

  exportBtn.addEventListener("click", exportNdjson);
  importInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await importNdjson(file);
  });
  clearBtn.addEventListener("click", async () => {
    if (confirm("确认清空全部链接？")) {
      if (hasCloud()) {
        try {
          await clearCloudItems();
        } catch (e) {
          alert(`云端清空失败: ${String(e)}`);
          return;
        }
      }
      saveItems([]);
      render();
    }
  });

  if (cfgForm) {
    cfgForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      saveCfg({ url: cfgUrl.value.trim(), anonKey: cfgKey.value.trim() });
      updateSyncBadge();
      await refreshFromCloudIfNeeded();
      render();
      alert("Supabase 配置已保存");
    });
  }

  if (cloudPullBtn) {
    cloudPullBtn.addEventListener("click", async () => {
      await refreshFromCloudIfNeeded();
      render();
    });
  }

  if (cloudOffBtn) {
    cloudOffBtn.addEventListener("click", () => {
      saveCfg({});
      if (cfgUrl) cfgUrl.value = "";
      if (cfgKey) cfgKey.value = "";
      updateSyncBadge();
      alert("已切回本地模式");
    });
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

(async () => {
  await refreshFromCloudIfNeeded();
  await handleShareTargetParams();
  bind();
  render();
})();
