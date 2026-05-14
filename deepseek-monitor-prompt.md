# DeepSeek Monitor 实时监控仪表板 — Claude Code 项目提示词

## 项目概述
开发一个 **实时数据驱动** 的 DeepSeek API 监控仪表板（Electron 桌面应用），通过本地代理拦截 + 官方余额 API 实现全量实时监控。不是静态展示，所有数据均来自实时接口或代理拦截记录。

---

## 核心架构：代理拦截 + 本地聚合

### 为什么需要代理拦截？
DeepSeek 官方 API 只提供：
1. **余额查询**：`GET https://api.deepseek.com/user/balance`
2. **每次请求的 usage 字段**：Chat Completion 响应中的 `usage.prompt_tokens` / `usage.completion_tokens` / `usage.prompt_cache_hit_tokens`

**没有历史用量 API**。所以必须采用「代理拦截」架构：所有发往 DeepSeek 的请求先经过本地代理，代理记录每次调用的 usage 后再转发，实现全量数据采集。

### 架构图
```
用户代码 / cc / 其他客户端
        ↓
  本地代理服务器 (localhost:9090)
    ├── 拦截请求，记录 model / timestamp
    ├── 转发至 api.deepseek.com
    ├── 拦截响应，提取 usage 字段
    ├── 计算本次费用（按模型定价）
    └── 写入本地 SQLite
        ↓
  WebSocket 推送 → 前端实时刷新
        ↓
  Electron 渲染进程（仪表板 UI）
```

同时后台定时器每 60 秒调用 `GET /user/balance` 获取实时余额。

---

## 数据层设计

### SQLite 表结构

```sql
-- API 调用记录表
CREATE TABLE api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  model TEXT NOT NULL,              -- 'deepseek-chat' / 'deepseek-reasoner' 等
  request_type TEXT,                 -- 'chat' / 'completion'
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cache_hit_tokens INTEGER DEFAULT 0,
  cache_miss_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_cny REAL DEFAULT 0,          -- 计算出的费用
  latency_ms INTEGER,               -- 响应延迟
  is_thinking BOOLEAN DEFAULT 0,    -- 是否启用 Thinking 模式
  status TEXT DEFAULT 'success',    -- 'success' / 'error' / 'timeout'
  error_message TEXT
);

-- 余额快照表（每次查询记录）
CREATE TABLE balance_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_balance REAL,
  granted_balance REAL,
  topped_up_balance REAL,
  currency TEXT DEFAULT 'CNY',
  is_available BOOLEAN
);

-- 每日聚合表（定时从 api_calls 聚合）
CREATE TABLE daily_summary (
  date DATE PRIMARY KEY,
  model TEXT,
  total_requests INTEGER,
  total_prompt_tokens INTEGER,
  total_completion_tokens INTEGER,
  total_tokens INTEGER,
  total_cost_cny REAL,
  avg_latency_ms REAL
);
```

### 费用计算逻辑（2026年5月 DeepSeek V4 定价）

```python
PRICING = {
    "deepseek-chat": {          # V4 Flash
        "input": 0.5 / 1_000_000,          # ¥0.5/M tokens
        "output": 2.0 / 1_000_000,         # ¥2.0/M tokens
        "cache_hit": 0.07 / 1_000_000,     # ¥0.07/M tokens (缓存命中)
    },
    "deepseek-reasoner": {      # V4 Pro
        "input": 4.0 / 1_000_000,          # ¥4.0/M tokens
        "output": 16.0 / 1_000_000,        # ¥16.0/M tokens
        "cache_hit": 1.0 / 1_000_000,      # ¥1.0/M tokens
    },
}

def calculate_cost(model, prompt_tokens, completion_tokens, cache_hit_tokens):
    pricing = PRICING.get(model, PRICING["deepseek-chat"])
    cache_miss_tokens = max(0, prompt_tokens - cache_hit_tokens)
    input_cost = cache_miss_tokens * pricing["input"] + cache_hit_tokens * pricing["cache_hit"]
    output_cost = completion_tokens * pricing["output"]
    return input_cost + output_cost
```

> 注意：定价可能变化，需从配置文件读取，而非硬编码。

---

## 实时数据源

### 1. 余额 API（官方）
```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <API_KEY>

响应：
{
  "is_available": true,
  "balance_infos": [
    {
      "currency": "CNY",
      "total_balance": "110.00",
      "granted_balance": "10.00",
      "topped_up_balance": "100.00"
    }
  ]
}
```
- 每 60 秒自动刷新
- 支持手动刷新
- 余额变化时显示趋势箭头（↑↓）

### 2. 代理拦截（核心）
- 本地 HTTP 代理运行在 `localhost:9090`
- 拦截所有 `POST /chat/completions` 和 `POST /completions`
- 从响应中提取 `usage` 对象：
```json
{
  "usage": {
    "prompt_tokens": 1024,
    "completion_tokens": 512,
    "total_tokens": 1536,
    "prompt_tokens_details": {
      "cached_tokens": 768
    }
  }
}
```
- 同时记录请求中的 `model` 字段
- 流式响应（SSE）也需处理：从最终 `[DONE]` 之前的 chunk 中累计 token

### 3. WebSocket 实时推送
- 代理每记录一条新调用，立即通过 WebSocket 推送到前端
- 前端收到推送后更新对应卡片/图表，无需轮询

---

## 界面设计

### 整体布局
- 深色主题，背景 #0f0f1a
- 圆角卡片式设计（12-16px border-radius）
- 毛玻璃/半透明效果（backdrop-filter: blur）
- 两栏布局：左侧主信息区，右侧详细统计区

### 顶部标题栏
- 左侧：⚡ Logo + "DeepSeek Monitor" 标题
- 中间：实时状态指示灯（绿色=代理运行中，红色=断开）
- 右侧：余额刷新按钮、设置按钮、最小化/关闭按钮

### 左侧面板

#### 卡片1：财务概览
- **账户余额**：从 `/user/balance` 实时获取，显示 ¥xx.xx
  - 子项：充值余额 / 赠送余额
  - 余额变化趋势箭头（与上次快照对比）
- **本月消费**：从 SQLite 本月记录聚合，橙色高亮
  - 子项：Flash 费用 / Pro 费用 分行显示

#### 卡片2：V4 Flash 实时状态
- ⚡ 闪电图标（蓝色 #3b82f6）
- **Token 数**：今日/本月 累计（从代理记录聚合）
- **费用**：今日/本月 费用
- **吞吐量**：Tokens/¥（实时计算）
- **进度条**：Flash 占总消耗的百分比
- **实时请求流**：最近 5 条请求滚动展示

#### 卡片3：V4 Pro 实时状态
- 🧠 大脑图标（紫色 #8b5cf6）
- 结构同 Flash 卡片

#### 卡片4：消耗趋势图
- 标题：消耗趋势
- Recharts 柱状图，展示最近 7 天的每日消耗
- 支持 Hover 显示具体数值
- 数据来自 `daily_summary` 表

### 右侧面板

#### 卡片1：关键指标行
- **API 请求次数**：今日/本月（蓝色大字体，从代理记录实时统计）
- **Total Tokens**：今日/本月（蓝色大字体）
- 数字变化时有动画效果（数字滚动）

#### 卡片2：按日 Token 消耗图
- 标题：按日 Token 消耗
- Recharts 柱状图，每日一根柱子
- Hover 显示：prompt_tokens / completion_tokens / cache_hit 分项
- 聚合数据来自 `daily_summary`

#### 卡片3：实时请求日志（新增）
- 最近 20 条 API 调用实时滚动
- 每行显示：时间 | 模型 | Tokens | 费用 | 延迟
- 新请求到达时自动滚动到底部
- 支持点击展开查看详情

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面框架** | Electron 28+ | 跨平台桌面应用 |
| **前端** | React 18 + TypeScript | UI 渲染 |
| **样式** | Tailwind CSS 3 | 深色主题 + 响应式 |
| **图表** | Recharts | 柱状图、趋势图 |
| **图标** | Lucide React | 统一图标风格 |
| **状态管理** | Zustand | 轻量级状态管理 |
| **实时通信** | WebSocket (ws) | 代理 → 前端推送 |
| **代理服务器** | Node.js http-proxy + 自定义中间件 | 拦截/转发/记录 |
| **数据库** | better-sqlite3 | 本地嵌入式 SQLite |
| **定时任务** | node-cron | 余额定时查询、日聚合 |

---

## 代理服务器核心实现

### 启动流程
```
1. Electron main 进程启动
2. 启动本地代理服务器 (localhost:9090)
3. 启动 WebSocket 服务器 (localhost:9091)
4. 初始化 SQLite 数据库
5. 启动余额定时查询（60s 间隔）
6. 启动日聚合定时任务（每日 00:05）
7. 打开渲染窗口
```

### 代理核心逻辑（伪代码）
```typescript
// 代理中间件
async function handleRequest(req, res) {
  const startTime = Date.now();
  const model = req.body.model;
  
  // 转发到 DeepSeek
  const upstream = await fetch('https://api.deepseek.com' + req.path, {
    method: 'POST',
    headers: { 'Authorization': req.headers.authorization },
    body: JSON.stringify(req.body),
  });
  
  const response = await upstream.json();
  const latency = Date.now() - startTime;
  
  // 提取 usage
  const usage = response.usage;
  const cost = calculateCost(model, usage);
  
  // 写入 SQLite
  db.insertApiCall({
    model, 
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    cache_hit_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
    cost_cny: cost,
    latency_ms: latency,
    timestamp: new Date().toISOString(),
  });
  
  // WebSocket 推送
  ws.broadcast({ type: 'new_call', data: { model, usage, cost, latency } });
  
  // 返回原始响应给客户端
  res.json(response);
}
```

### SSE 流式响应处理
```typescript
async function handleStreamRequest(req, res) {
  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': req.headers.authorization },
    body: JSON.stringify(req.body),
  });
  
  let totalContent = '';
  let usage = null;
  
  // 透传 SSE 流
  res.setHeader('Content-Type', 'text/event-stream');
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    res.write(chunk);
    
    // 从最后一个 chunk 提取 usage
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const data = JSON.parse(line.slice(6));
        if (data.usage) usage = data.usage;
      }
    }
  }
  
  // 流结束后记录
  if (usage) {
    const cost = calculateCost(req.body.model, usage);
    db.insertApiCall({ ...usage, cost, model: req.body.model });
    ws.broadcast({ type: 'new_call', data: { usage, cost } });
  }
  
  res.end();
}
```

---

## 配置文件

```yaml
# config.yaml
proxy:
  port: 9090
  upstream: https://api.deepseek.com
  
websocket:
  port: 9091

balance:
  refresh_interval_seconds: 60
  api_key: ""                    # 首次启动时引导用户填写

database:
  path: "./data/monitor.db"

pricing:                         # 可随时更新
  deepseek-chat:                # V4 Flash
    input: 0.5                  # ¥/M tokens
    output: 2.0
    cache_hit: 0.07
  deepseek-reasoner:            # V4 Pro
    input: 4.0
    output: 16.0
    cache_hit: 1.0

aggregation:
  daily_cron: "5 0 * * *"      # 每日 00:05 聚合
```

---

## 交互需求

1. **首次启动**：引导用户输入 API Key，测试连通性
2. **代理配置指引**：提示用户将 `localhost:9090` 设为 HTTP 代理
3. **实时刷新**：WebSocket 推送 → 无需手动刷新
4. **手动刷新余额**：点击刷新按钮立即查询
5. **图表交互**：Hover 显示详情，支持按模型筛选
6. **时间范围切换**：今日 / 7天 / 30天 / 本月
7. **请求日志搜索**：按模型/时间/费用筛选
8. **导出功能**：CSV / JSON 导出用量数据
9. **系统托盘**：最小化到托盘，后台持续监控
10. **余额预警**：余额低于阈值时桌面通知

---

## 实现步骤（优先级排序）

### Phase 1：核心数据管道（3-4天）
1. 初始化 Electron + React + Vite 项目
2. 实现代理服务器（http-proxy）
3. 实现 SSE 流式拦截
4. SQLite 数据层 + 费用计算
5. WebSocket 推送

### Phase 2：UI 框架（2-3天）
6. Tailwind 深色主题配置
7. 布局骨架（两栏）
8. 财务概览卡片（余额实时展示）
9. 模型使用卡片（Flash / Pro）

### Phase 3：图表与日志（2-3天）
10. Recharts 趋势图 + 消耗柱状图
11. 实时请求日志面板
12. 时间范围切换
13. 日聚合定时任务

### Phase 4：体验优化（1-2天）
14. 首次启动引导流程
15. 系统托盘 + 余额预警
16. 导出功能
17. 性能优化（大量数据时的图表渲染）

---

## 关键注意事项

1. **代理必须透明**：不能修改请求/响应内容，只做记录和转发
2. **API Key 安全**：使用 Electron safeStorage API 加密存储，不明文落盘
3. **SSE 流处理**：流式响应必须逐 chunk 转发，不能缓冲整个响应后再转发
4. **定价可配置**：DeepSeek 定价可能变动，必须从配置文件读取
5. **错误容忍**：代理出错时不能影响上游 API 调用，需 fallback 到直连
6. **数据清理**：提供自动清理 90 天前详细记录的选项（保留日聚合）
7. **多 Key 支持**：未来可能需要同时监控多个 API Key
