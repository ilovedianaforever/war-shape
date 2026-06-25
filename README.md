# 战争的形状 (War Shape) — 运行指南

> 基于 Next.js + MapLibre GL + deck.gl 构建的交互式战争与冲突时空可视化项目。支持 CDB90 历史战役（1600-1973）和 UCDP 当代冲突（1989-2025）双模式切换。

> **GitHub Page**: [https://ilovedianaforever.github.io/war-shape](https://ilovedianaforever.github.io/war-shape)  
> **仓库**: [https://github.com/ilovedianaforever/war-shape](https://github.com/ilovedianaforever/war-shape)
---

## 一、项目简介

战争的形状 (War Shape) 是一个交互式战争与冲突时空可视化 Web 应用，支持 CDB90 历史战役（1600-1973）和 UCDP 当代冲突（1989-2025）双模式切换。核心功能包括：

- **暗色主题世界地图**：使用 CartoDB Dark Matter 免费瓦片服务
- **时间轴动画**：年份滑块 + 播放/暂停，自动逐帧推进
- **3D 伤亡柱体**：deck.gl ColumnLayer，柱高按幂函数缩放，"一飞冲天"
- **六边形密度网格**：H3 六边形聚合冲突密度
- **流向弧线 + 粒子动画**：攻方国家质心到战场的流动弧线
- **热力图层**：一键切换密度热力图
- **地区筛选**：非洲/中东/亚洲/欧洲/美洲多选
- **实时统计**：事件数、死亡人数、Top 5 排名
- **事件详情弹窗**：点击任意点查看详情

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Next.js 16 (App Router) + React 19 | TypeScript |
| **地图库** | MapLibre GL JS v5.18 | 开源 Mapbox 替代品，GPU 渲染 |
| **地图样式** | CartoDB Dark Matter | 暗色主题，完全免费，无需 API Key |
| **UI 框架** | Tailwind CSS v4 | 玻璃拟态 (Glassmorphism) 暗色 UI |
| **图标** | Lucide React | 开源图标库 |
| **数据源** | UCDP GED API v25.1 | 乌普萨拉冲突数据项目，免费公开 |

**最重要的是：整个项目不需要任何 API Key、Token 或密钥。地图瓦片来自 CartoDB 免费 CDN，冲突数据来自 UCDP 免费公开 API。**

---

## 三、快速开始

### 3.1 环境要求

- Node.js >= 18（推荐 20+）
- npm >= 9

检查环境：
```bash
node --version    # 应 >= 18
npm --version     # 应 >= 9
```

### 3.2 安装依赖

```bash
cd war-shape
npm install
```

### 3.3 启动开发服务器

```bash
npm run dev
```

浏览器访问 **http://localhost:3000**。

全部数据已预置在 `public/data/` 目录中（battle_events.json + UCDP 年份分片），无需联网拉取 API。

### 3.4 构建生产版本

```bash
npm run build
npm run start
```

构建产物在 `.next/` 目录下。也可以部署到 Vercel（项目自带 `vercel.json` 配置）。

---

## 四、项目结构

```
war-shape/
├── package.json              # 依赖和脚本
├── tsconfig.json             # TypeScript 配置
├── next.config.ts            # Next.js 配置
├── vercel.json               # Vercel 部署配置
├── README.md                 # 原项目英文说明
├── 运行指南.md               # 本文档
├── src/
│   ├── app/
│   │   ├── layout.tsx        # 根布局（标题、字体、元数据）
│   │   ├── page.tsx          # 主页面（组合所有组件）
│   │   ├── globals.css       # 全局样式（暗色主题、玻璃态、自定义滑块/复选框）
│   │   └── api/conflicts/
│   │       └── route.ts      # API 路由（代理 UCDP API，加缓存）
│   ├── components/
│   │   ├── ConflictMap.tsx   # 核心地图组件（MapLibre + 散点/热力图层）
│   │   ├── Sidebar.tsx       # 侧边栏（年份滑块、地区筛选、统计、排名）
│   │   └── EventModal.tsx    # 事件详情弹窗
│   ├── services/
│   │   └── conflictData.ts   # 数据服务（单例、按年拉取、内存缓存）
│   └── types/
│       └── conflict.ts       # TypeScript 类型定义
```

---

## 五、核心文件说明

### 5.1 ConflictMap.tsx — 地图组件

这是整个项目的核心，**不依赖 deck.gl**，直接使用 MapLibre GL JS 的原生图层：

- **底图**：来自 `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`（CartoDB 免费暗色矢量瓦片）
- **散点图层** (`conflicts-points`)：圆形标记，半径 3-18px 按死亡人数缩放，颜色按暴力类型
- **热力图层** (`conflicts-heat`)：黄色→橙色→红色→暗红渐变，按死亡人数加权
- **交互**：hover 弹出信息，click 打开详情弹窗

### 5.2 Sidebar.tsx — 侧边栏

- 年份滑块：HTML range input，从数据中提取年份范围
- 播放/暂停：5 秒逐帧动画（可在代码中调整速度）
- 地区筛选：5 个复选框
- 视图切换：散点 / 热力图
- 实时统计卡片
- Top 5 最致命冲突排名

### 5.3 conflictData.ts — 数据服务

单例模式的服务类：
- 按年从 UCDP API 分页拉取数据
- 内存缓存已拉取的年份
- 预加载相邻年份
- 根据地区筛选

### 5.4 route.ts — API 路由

Next.js API 路由，代理转发到 UCDP API，添加 24 小时服务器端缓存。

---

## 六、如何改造为 CDB90 历史战役项目

### 6.1 改造思路

当前项目从 UCDP API **实时拉取** 数据。改造后改为从 **本地 JSON 文件** 加载数据。

核心思路：只需要修改 3 个文件（数据层），UI 组件完全不用动。

### 6.2 改造步骤

#### 第 1 步：生成 battle_events.json

用现有的 `datastore.py` 把 CDB90 CSV 导出为前端可用的 JSON：

```python
# generate_battle_events.py
import json
import pandas as pd
from datastore import store

events = []
for _, row in store.battle_sides.iterrows():
    events.append({
        "id": int(row.get("battle_id", 0)),
        "name": str(row.get("battle_name", "")),
        "sideA": str(row.get("attacker_name", "")),
        "sideB": str(row.get("defender_name", "")),
        "latitude": float(row.get("lat", 0)),
        "longitude": float(row.get("lon", 0)),
        "deaths": int(row.get("cas_total", 0) or 0),
        "date": str(row.get("date_start", "")),
        "year": int(row.get("year", 0)),
        "region": str(row.get("region", "")),
        "typeOfViolence": 1,         # 统一标记为 "state-based"
        "country": str(row.get("location", "")),
        "sources": str(row.get("wiki_url", "")),
        "winner": str(row.get("winner", "")),
        "terrain": str(row.get("terrain", "")),
        "weather": str(row.get("weather", "")),
        "total_troops": int(row.get("total_forces", 0) or 0),
        "casualty_rate": float(row.get("casualty_rate", 0) or 0)
    })

with open("public/data/battle_events.json", "w", encoding="utf-8") as f:
    json.dump(events, f, ensure_ascii=False, indent=2)

print(f"Exported {len(events)} battle events")
```

#### 第 2 步：修改 types/conflict.ts

在 ProcessedEvent 接口中添加你的自定义字段：

```typescript
export interface ProcessedEvent {
  id: number;
  name: string;
  sideA: string;
  sideB: string;
  latitude: number;
  longitude: number;
  deaths: number;
  date: string;
  year: number;
  region: string;
  typeOfViolence: number;
  country: string;
  sources: string;
  // CDB90 新增字段
  winner: string;
  terrain: string;
  weather: string;
  total_troops: number;
  casualty_rate: number;
}
```

#### 第 3 步：修改 services/conflictData.ts

把 `fetchYearData()` 改为直接读取本地 JSON：

```typescript
import battleData from '@/data/battle_events.json'; // 或者用 fetch

// 直接全量加载（600 条数据很小，不需要分年拉取）
async loadAllBattles(): Promise<ProcessedEvent[]> {
  const response = await fetch('/data/battle_events.json');
  return response.json();
}
```

#### 第 4 步：修改颜色映射

在 `ConflictMap.tsx` 的 `'circle-color'` 表达式中，按胜负结果而不是暴力类型上色：

```typescript
'circle-color': [
  'match', ['get', 'winner'],
  'attacker', '#dc2680',   // 攻方胜 — 红色
  'defender', '#3b82f6',   // 守方胜 — 蓝色
  'draw', '#facc15',       // 平局 — 黄色
  '#6b7280'                // 未知 — 灰色
],
```

按伤亡率映射大小：
```typescript
'circle-radius': [
  'interpolate', ['linear'], ['get', 'casualty_rate'],
  0, 3, 0.1, 6, 0.3, 10, 0.5, 15, 1.0, 22
],
```

#### 第 5 步：调整时间范围和 UI 文案

- `Sidebar.tsx`：将年份范围改为你的 1600-1973
- `page.tsx`：改标题为"战争的形状：600 场战役的时空伤痕"
- `EventModal.tsx`：在详情弹窗中展示胜负、地形、天气等字段

### 6.3 改造工作量评估

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 生成 battle_events.json | 1 小时 | 用 datastore.py 写一个导出脚本 |
| 修改类型定义 | 15 分钟 | 添加几个字段 |
| 修改数据加载 | 30 分钟 | 从 API 改为本地 JSON |
| 调整年份范围 | 15 分钟 | 滑块范围 1600-1973 |
| 修改颜色映射 | 30 分钟 | 按胜负/伤亡率映射 |
| 修改弹窗内容 | 1 小时 | 展示你关心的字段 |
| UI 文案中文化 | 1 小时 | 标题、侧边栏标签等 |
| **总计** | **约 4-5 小时** | 一个下午就能完成核心改造 |

---

## 七、为什么这个项目适合做基础框架

1. **完全免费、无 API Key**：MapLibre + CartoDB Dark Matter，不需要 Mapbox Token
2. **暗色主题开箱即用**：玻璃拟态 UI，非常像路透社的数据新闻风格
3. **时间轴动画已做好**：播放/暂停/年份滑块直接拿来用
4. **数据层解耦良好**：改 `conflictData.ts` 就能换数据源，UI 组件不用动
5. **TypeScript + Next.js**：代码结构清晰，类型安全
6. **已验证可构建**：在此环境中 `npm install` + `npm run build` 均通过
7. **性能优秀**：38.5 万条数据流畅渲染，600 条完全无压力

---

## 八、已知小问题

构建时有 2 个不影响运行的 warning：
1. CSS `@import` 顺序问题（Google Fonts 的 Inter 字体）
2. Next.js 16 的 metadata viewport 弃用提示

这些都不影响功能，可以忽略。如需消除，见 Next.js 官方文档的 `generateViewport` 迁移指南。

---

## 九、原项目许可

MIT License — 完全开源，可自由修改、分发、商用。

---

---