# Evergate AI Office（3D 虚拟办公室）

- Source: `index.html`, `src/main.js` (app/UI/data), `src/scene.js` (3D office), `src/style.css`
- Data: `public/data.json` (copied to `dist/data.json`). Edit teams / statuses / tasks / feed here; the app re-fetches every 60 s.
  - team.status: `busy` 忙碌 | `confirm` 等你确认 | `idle` 空闲; `statusNote` overrides the label (e.g. 待命)
  - task.status: `doing` 进行中 | `confirm` 等你确认 | `done` 已完成
  - feed: `{ team, time (ISO with +08:00), text }`
  - Team ids map to rooms: ed, market(市场部), legal(法务部), invest(投资部), info(信息部), corpfin(会计部), logistics(物流部), design(设计部), privfin(私人助理, private)
  - `directory.groups` / `directory.statusGroups` drive the 部门总览 tab (按类别 / 按状态). Tasks shown there come from `tasks`.
- Build: `npm ci && npm run build` → `dist/index.html` (single file, all JS/CSS inlined, data.json embedded as fallback) + standalone `dist/data.json`, `dist/manifest.webmanifest`, `dist/icons/`
- Host: GitHub Actions deploys `dist/` to GitHub Pages at https://edvisionedward-boop.github.io/Evergate-Office/ (Vite `base` is `/Evergate-Office/`). On iPhone Safari → Share → 添加到主屏幕.
- Update data without code changes: edit `public/data.json` and push to `main`. The workflow republishes that file as `/Evergate-Office/data.json`. The app fetches it on load and again every 60 seconds.
- Dashboard: `public/dashboard.html` is published as https://edvisionedward-boop.github.io/Evergate-Office/dashboard.html (a Dashboard link in the office top nav opens it). It reads `data.json` plus `data/progress.json`, `data/usage.json`, `data/exams.json`, and `data/pipeline.json`. Chart.js 4.4.6 (MIT) is vendored at `public/vendor/chart.umd.min.js`. The blurred interior background is original (`public/assets/dashboard-bg.jpg`, see `dashboard-bg.txt`).
- Screenshots: `node scripts/shot.mjs http://127.0.0.1:4173/Evergate-Office/ screens desk,phone`
