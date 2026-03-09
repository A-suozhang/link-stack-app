# Link Stack App (PWA MVP)

一个可部署到 GitHub Pages 的手机“分享接收器”。

## 能力
- 安装到手机主屏后，可在系统“分享”里选择本应用（支持 Web Share Target 的浏览器环境）
- 接收分享链接并入栈（本地 localStorage）
- 去重
- 导出/导入 NDJSON（方便后续喂给本机处理器）

## 本地预览
```bash
cd /Users/a-suozhang/project/notion_tool/link-stack-app
python3 -m http.server 8899
```
打开 `http://127.0.0.1:8899`

## 部署到 GitHub Pages
- 把 `link-stack-app` 目录内容发布到 Pages 分支/目录
- HTTPS 下安装 PWA

## 说明
- 这是纯前端，不包含任何密钥和后端逻辑
- 分享接收能力取决于手机浏览器对 Web Share Target 的支持

## 跨平台同步（Supabase，可选）
当前版本为固定云端模式，`Supabase URL + anon key` 写在前端代码中，页面不再显示配置入口。

### 最小 SQL
```sql
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  note text default '',
  source text default 'manual',
  status text default 'pending',
  created_at timestamptz default now()
);
```

### RLS（先用简单策略）
如果开启 RLS，请至少允许 `anon` 的 `select/insert/delete`（MVP）。
上线后建议再收紧为你自己的登录策略。
