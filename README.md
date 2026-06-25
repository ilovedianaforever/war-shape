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

# 战争可视化项目 — 改造与优化工作总结

> 项目名称：**战争的形状 (War Shape)**
> 基础框架：基于 Next.js 16 + MapLibre GL + deck.gl
> 改造日期：2026-06-24


---

## 第一部分：性能优化

### 1.1 当代冲突模式伤痕累积卡顿修复

**问题**：`FlashOverlay.tsx` 中 `scarMarksRef` 在当代冲突模式下无限累积伤疤标记——UCDP 每年数百条事件，播放时每帧全量重绘数千个径向渐变圆形，Canvas 2D 绘制调用量爆炸，越到后期越卡。

**修复**：
- 伤疤标记生成仅限于战争模式（`dataMode === 'war'`），冲突模式不创建伤疤 Canvas 元素
- `syncCanvasSize` 中移除对伤疤 Canvas 的强制依赖，确保闪点 Canvas 可独立初始化尺寸
- 每帧全量重绘仅在战争模式执行

### 1.2 流向弧线播放卡死修复（根因修复）

**问题**：`DeckGlOverlay.tsx` 中 ArcLayer 在播放时对 `getSourcePosition` 和 `getTargetPosition` 各加了 400ms 过渡动画（`transitions`）。播放时年份切换速度极快（可能每 100-200ms 一帧），deck.gl 内部前一批 400ms 动画还没完成就收到新图层实例，动画队列不断堆积，后期 GPU 负载爆炸，浏览器直接冻结并跳到 2025 年。

**修复**：
- ArcLayer 播放模式下移除全部 `transitions`，弧线直接跳变
- `MapboxOverlay.setProps({ layers })` 改用 `requestAnimationFrame` 节流——同一帧内多次变化只推送一次更新，避免 deck.gl 每 tick 都重建 WebGL 资源
- 销毁 MapboxOverlay 时同步 `cancelAnimationFrame` 清理未执行的回调

### 1.3 当代冲突模式流向弧线二次卡顿修复

**问题**：Canvas 2D `ArcFlowOverlay` 粒子层在冲突模式下渲染量过大——大圆路径 40 个球面插值点 × 300+ 条弧线的 `map.project()` 调用 × 3 个粒子 = 每秒数千次坐标投影，Canvas 绘制跟不上。

**修复**：
- 粒子数 `PARTICLES_PER_ARC`：3 → 2
- 大圆采样点 `GREAT_CIRCLE_SAMPLES`：40 → 16（`map.project()` 调用量减少 60%）
- 光点径向渐变三层透明度各降约一半：白色核心 0.95→0.6，彩色层 0.7→0.4，外围 0.2→0.1，光晕半径同步缩小

### 1.4 闪点频率调整

`TARGET_FLASHES_PER_SEC_CONFLICT` 从 800 降为 200。原来一秒内把所有事件压缩闪完，现在舒展成 5 倍时长，观看体验更舒缓，每帧粒子计算量也降低 75%。

### 1.5 当代冲突模式闪点动画失效修复

**问题**：年份切换时 UCDP 数据异步加载。React 流程中 `setUcdpLoading(true)` 触发重渲染时 `ucdpEvents` 仍保留上一年旧数据的新数组引用，`FlashOverlay` 误检测为新批次而重播旧年份闪点，随后加载完成再次触发，形成"旧数据误重播→纠正"循环，在快速连续播放中间歇性卡死或直接不显示。

**修复**：`page.tsx` useEffect 进入异步加载前先 `setUcdpEvents([])` 清空数组。FlashOverlay 收到空数组后进入等待重试模式（已有逻辑），数据加载完成后用正确年份启动新批次。

---

## 第二部分：视觉效果增强

### 2.1 柱体高度与分明度（两轮迭代）

**第一轮**：乘法系数从 1200 提升到 8000（`log10(c+1) × 8000`），100 万人伤亡 ≈ 48km 高，但大小战役差异仅约 3 倍，"分明度"不够。

**第二轮**：公式改为 `log10(c+1)^2.2 × 3000`。

| 伤亡人数 | 旧高度 (旧) | 新高度 | 倍数差异 |
|---------|-----------|--------|---------|
| 100人 | ~16km | ~14km | — |
| 1万人 | ~32km | ~63km | 2× |
| 100万人 | ~48km | ~155km | 3.2× vs 旧 / 11× vs 小 |

幂指数 2.2 是关键——将对数曲线的"平"拉成"陡"，100 人战斗和 100 万人大屠杀之间高度差从 3 倍拉大到 11 倍。小战役是一个可见小柱，大战役直接刺穿大气层。六边形网格的柱高也同步使用同一公式。

### 2.2 流向弧线粒子动画（ArcFlowOverlay）

**设计思路**：独立 Canvas 2D 叠加层，位于 deck.gl ArcLayer 之上。计算每条弧线的二次贝塞尔路径，在路径上放置若干发光粒子，每 rAF 帧推进粒子位置（`pt.t += pt.speed`），到终点后循环重生。光点用三层径向渐变绘制带发光效果。

**实现细节**：
- 每条弧线 2 个粒子，起始位置错开（均匀分布在 0→1 路径上）
- 粒子行进速度约 0.018~0.04/帧，约 1 秒飞完一条弧
- 渲染栈：MapLibre GL 底图 → deck.gl ColumnLayer → deck.gl ArcLayer → Canvas 2D 粒子层
- 坐标对齐用 `map.project()` 将经纬度转屏幕坐标

### 2.3 GPU 散点（ScatterplotLayer）

用 deck.gl 原生 `ScatterplotLayer` 替换 Canvas 2D `FlashOverlay`。点大小按伤亡对数映射（半径 1km-30km），颜色用柱体同款暖色渐变，`antialiasing: true` 保证边缘平滑。WebGL 渲染天然优于 Canvas 2D 逐点绘制，尤其在冲突模式高事件密度场景。

### 2.4 大圆弧线（GreatCircleLayer）

引入 `@deck.gl/geo-layers` 的 `GreatCircleLayer`，弧线按地球大圆路径弯曲（而非简单贝塞尔），更符合真实地理投影。`ArcFlowOverlay` 同步适配——大圆模式下用球面线性插值（slerp）采样 16 个中间路径点，粒子沿采样折线运动。

**后续调整**：发现大圆弧线在墨卡托投影上两地极远时（如跨太平洋），大圆路径会退化为近似直线甚至从地球背面绕行，看起来像横穿整个地图的横线。将 `useGreatCircle` 默认值从 `true` 改为 `false`，默认使用 ArcLayer 贝塞尔弧线（始终呈优美抛物线）。用户可通过侧边栏开关手动切换。

### 2.5 H3 六边形密度网格（H3HexagonLayer）

使用 H3 分辨率 3（每格边长约 60km，适合洲际尺度），`latLngToCell()` 将冲突点映射到 H3 六边形索引，聚合每个格内伤亡总量。`H3HexagonLayer` 以挤出六边形柱体显示密度分布，柱高同 `getColumnElevation()` 公式。播放模式下开启 600ms 生长过渡。平视模式（不触发相机俯角变化）。

### 2.6 deck.gl 扩展可行性分析

基于 deck.gl 全功能库所做的可视化扩展潜力评估，按视觉冲击力分为三梯队：

**第一梯队（强烈推荐 — 已实现）**：
- H3HexagonLayer：六边形冲突密度网格
- ScatterplotLayer：GPU 加速散点
- GreatCircleLayer：大圆路径弧线

**第二梯队（值得考虑）**：
- PathLayer：军队行军路线/难民流向（需要路径数据）
- IconLayer：战役类型图标标记（盾牌=防御，双剑=野战，城堡=攻城）
- ContourLayer：冲突强度等值线（类似气象图）

**第三梯队（锦上添花）**：
- TextLayer：悬浮标签（Top 5 战役名称+伤亡）
- PolygonLayer：冲突区域填充（内战控制区边界）
- Tile3DLayer：3D 地形叠加（山区冲突地形感知）

### 2.7 流向弧线镜像倒影修复

**问题**：`ArcFlowOverlay` 贝塞尔控制点 y 方向取决于源-目标水平方向（`perpY = dx/dist`）。源点在目标左侧时 perpY 为正，控制点在中点下方 → 弧线向下弓。deck.gl ArcLayer 弧线从地表升起、固定向上弓。两者方向相反，粒子跑在弧线的"镜面倒影"上。

**修复**：`ctrlY = midY - Math.abs(perpY) * arcHeight`。强制 y 偏移始终为屏幕上方（负值），弧线永远向上弓起，与 deck.gl 方向一致。横向 perpX 偏移保留以保证左右侧弯自然。

---

## 第三部分：UI/UX 改进

### 3.1 侧边栏图层开关互斥

GPU 散点与闪点动画互斥——两个都是"显示当年事件散点"的不同实现，不应同时开启。点击任一方自动关闭对方。对端禁用态：整行 `opacity-40` 变暗，`disabled` 不可点击，光标变 `cursor-not-allowed`。桌面端和移动端均实现此逻辑（后续移动端代码被移除）。

### 3.2 移动端代码移除

`Sidebar.tsx` 中约 220 行移动端底部操作栏（`mobileBar` 常量）和弹出面板代码完全删除。原因：该项目重度依赖 WebGL（deck.gl 3D 图层 + MapLibre GL + Canvas 粒子），移动端浏览器 GPU 性能完全不足以驱动，移动端代码纯属误导。同步清理的未使用图标导入：`ChevronUp/Down`、`X`、`Users`、`Skull`、`Loader2`、`useState`。

### 3.3 六边形网格不触发相机俯角

`showHexagons` 从相机俯角控制和旋转交互条件中移除。六边形密度网格是俯视视角下的宏观分析图层，平视效果最佳。仅 `showColumns` 和 `showArcs` 仍然触发 50° 俯角。

### 3.4 useEffect 依赖数组稳定性

移除 `showHexagons` 后 useEffect 依赖数组元素数从 4 变为 3，触发 React Fast Refresh HMR 一致性检查警告（`The final argument passed to useEffect changed size between renders`）。将 `showHexagons` 加回依赖数组保持签名稳定——变量在 effect 内部虽未使用（六边形不参与俯角判断），但保持数组元素数恒定消除 HMR 噪音。

---

## 第四部分：架构与数据修复

### 4.1 当代冲突柱体数据源修复

**问题**：`DeckGlOverlay` 的 `columnData` 始终使用 `allEvents`（战争模式数据），冲突模式下 UCDP 数据按年异步加载到 `ucdpEvents`，从未传入柱体计算管道。

**修复流程**（三文件联动）：
1. `page.tsx`：新增 `conflictColumnEvents` 状态，每次加载 UCDP 年份数据时按 `id` 去重累积，切换模式时清零
2. `ConflictMap.tsx`：新增 `conflictColumnEvents` prop 并透传给 `DeckGlOverlay`
3. `DeckGlOverlay.tsx`：新增 `conflictColumnEvents` prop，冲突模式（`dataMode === 'conflict'`）下用它替代 `allEvents` 做柱体累积

效果：当代冲突模式中柱体随年份推进逐渐增长——1989 年零散小柱，2000 年起密集中型柱，2014-2025 年高峰年份伤亡密集区堆出巨大柱群。

### 4.2 三个独立项目结构澄清

`期末项目/` 下实际包含三个独立项目（非一个整体）：
- `war-shape/`：Next.js 16 前端（战争的形状），核心交付物
- `sandtable/`：3D Cesium 沙盘推演（独立静态 HTML）
- `dashboard/`：Python Dash 数据看板（独立 Python 应用）

三者共享 `datasets/` 数据、`scripts/` 脚本和 `docs/` 文档。war-shape 是自包含的 Next.js 项目，压缩后可独立交付队友运行，无需外部依赖。

---

## 第九部分：队友交付指南

拿到 `war-shape/` 文件夹后：

```bash
cd war-shape
npm install          # 安装依赖（约 2-3 分钟）
npm run dev          # 启动开发服务器
# 浏览器访问 http://localhost:3000
```

环境要求：Node.js ≥ 18，不支持移动端浏览器。

全部数据已预置在 `public/data/` 中（`battle_events.json` 1 MB + `countries.json` 10 MB + `ucdp/` 年份分片 36 个文件约 200 MB），无需联网拉取任何 API。压缩包大小约 30-50 MB。

---

*文档生成于 2026-06-21，覆盖全部改造过程。*

---
