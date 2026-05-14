# Claude-DeepSeek Monitor

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

实时监控 Claude Code 中 DeepSeek API 用量、Token 消耗、缓存命中率及余额的桌面应用。

---

## 功能

-  **余额监控** — 每 60 秒自动拉取 DeepSeek 账户余额，充值 / 赠送分开展示，余额变化趋势箭头
-  **月度费用** — 对接 DeepSeek 官方 Cost API，精确到每日费用明细
-  **Token 统计** — 对接官方 Amount API，Prompt / Completion 拆分，双轴图表可视化
-  **缓存命中率** — 月度 + 单次调用两级缓存效率监测，进度条展示
-  **实时请求流** — 扫描 Claude Code 本地对话日志，展示每次 API 调用的 Token 详情
-  **一键登录** — 内置浏览器窗口登录 DeepSeek 平台，自动获取认证 Token
-  **迷你悬浮窗** — 桌面置顶小窗，核心指标一目了然
-  **任务栏集成** — 系统托盘图标 + 右键菜单实时显示余额/费用
-  **全自动刷新** — 启动即拉取数据，每 60 秒增量更新，数据推送即时刷新前端
-  **深色主题** — 暗色 UI + 毛玻璃卡片风格

---

## 安装

### 开发模式

```bash
git clone https://github.com/<your-username>/claude-deepseek-monitor.git
cd claude-deepseek-monitor
npm install
npm run dev
```

### 打包

```bash
npm run build          # 编译前后端
npm run pack           # 生成可执行文件 (release/win-unpacked/)
npm run dist           # 生成安装包
```

> 安装过程会自动运行 `electron-rebuild` 编译 `better-sqlite3` 原生模块。

---

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 桌面框架 | Electron 33 | 跨平台桌面壳 |
| 前端 | React 18 + TypeScript | 渲染进程 |
| 样式 | Tailwind CSS 3 | 深色主题 |
| 图表 | Recharts | Token 消耗柱状/折线图 |
| 图标 | Lucide React | 统一图标库 |
| 状态管理 | Zustand | 轻量级 |
| 数据库 | better-sqlite3 | 本地嵌入式 SQLite |
| 定时任务 | node-cron | 每日聚合 |
| FFI | koffi | 纯 JS 调用 Windows API |

---

## 数据来源

| API | 端点 | 提供数据 |
|---|---|---|
| 余额 | `api.deepseek.com/user/balance` | 账户余额、充值余额、赠送余额 |
| 费用 | `platform.deepseek.com/api/v0/usage/cost` | 月度总费用 + 每日费用 (CNY) |
| 用量 | `platform.deepseek.com/api/v0/usage/amount` | Token 数 + API 请求次数 |
| CC 日志 | `~/.claude/projects/**/*.jsonl` | 逐条 API 调用 Token 详情 |

---

## 项目结构

```
src/
├── main/                     # Electron 主进程
│   ├── index.ts              # 启动入口 + 托盘
│   ├── api-fetcher.ts        # Cost / Amount API 数据获取
│   ├── balance-poller.ts     # 余额轮询（60s）
│   ├── cc-log-parser.ts      # Claude Code JSONL 日志解析
│   ├── database.ts           # SQLite CRUD + 统计查询
│   ├── config.ts             # YAML 配置读写
│   ├── mini-window.ts        # 迷你悬浮窗管理
│   ├── scheduler.ts          # 每日聚合任务
│   ├── ipc-handlers.ts       # IPC 通信处理
│   └── preload.ts            # 安全上下文桥接
├── renderer/                 # React 前端
│   ├── App.tsx               # 主布局 + 迷你窗路由
│   ├── components/
│   │   ├── Header.tsx        # 顶部栏（数据同步/导出/设置）
│   │   ├── BalanceCard.tsx   # 财务概览卡片
│   │   ├── FlashCard.tsx     # V4 Flash 统计
│   │   ├── ProCard.tsx       # V4 Pro 统计
│   │   ├── TokenChart.tsx    # Token 消耗双轴图表
│   │   ├── KeyMetrics.tsx    # 关键指标行
│   │   ├── RequestLog.tsx    # 实时请求日志
│   │   ├── SettingsModal.tsx # 设置面板
│   │   ├── SetupWizard.tsx   # 首次启动引导
│   │   ├── MiniWidget.tsx    # 桌面迷你悬浮窗
│   │   └── StatusBar.tsx     # 状态提示条
│   └── store/useStore.ts     # Zustand 全局状态
└── shared/types.ts           # 共享类型定义
```

---

## 配置 (`config.yaml`)

```yaml
balance:
  api_key: sk-xxx
  refresh_interval_seconds: 60

pricing:
  deepseek-chat:        # V4 Flash
    input: 0.5           # ¥/M tokens
    output: 2.0
    cache_hit: 0.07
  deepseek-reasoner:    # V4 Pro
    input: 4.0
    output: 16.0
    cache_hit: 1.0
```

---

## 数据准确性

每月费用、每日 Token 等核心统计数据直接来自 DeepSeek 官方 API（`/api/v0/usage/cost` 和 `/api/v0/usage/amount`），与 `platform.deepseek.com` 网页端数据一致。

---

## License

MIT
