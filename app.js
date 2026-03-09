const KEY = "link_stack_items_v1";

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

function addItem(url, note = "", source = "manual") {
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
  items.unshift(item);
  saveItems(items);
  return { ok: true, item };
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
    del.onclick = () => {
      const next = loadItems().filter((x) => x.id !== item.id);
      saveItems(next);
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
        const r = addItem(obj.url, obj.note || "", obj.source || "import");
        if (r.ok) n += 1;
      }
    } catch {
      // ignore bad line
    }
  }
  alert(`导入完成，新增 ${n} 条`);
  render();
}

function handleShareTargetParams() {
  const q = new URLSearchParams(location.search);
  const title = q.get("title") || "";
  const text = q.get("text") || "";
  const url = q.get("url") || "";
  const candidates = [url, ...text.split(/\s+/), ...title.split(/\s+/)];

  let added = 0;
  for (const c of candidates) {
    if (!c.startsWith("http://") && !c.startsWith("https://")) continue;
    const r = addItem(c, "shared", "share_target");
    if (r.ok) added += 1;
  }
  if (added > 0) {
    history.replaceState({}, "", location.pathname);
    alert(`已从分享接收 ${added} 条链接`);
  }
}

function bind() {
  const form = document.getElementById("add-form");
  const exportBtn = document.getElementById("export-btn");
  const importInput = document.getElementById("import-file");
  const clearBtn = document.getElementById("clear-btn");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = document.getElementById("url").value;
    const note = document.getElementById("note").value;
    const r = addItem(url, note, "manual");
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
  importInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importNdjson(file);
  });
  clearBtn.addEventListener("click", () => {
    if (confirm("确认清空全部链接？")) {
      saveItems([]);
      render();
    }
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

handleShareTargetParams();
bind();
render();
