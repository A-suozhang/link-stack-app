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
