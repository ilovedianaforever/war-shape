# 战争的形状 (War Shape) — 运行指南

> 基于 Next.js + MapLibre GL + deck.gl 构建的交互式战争与冲突时空可视化项目。支持 CDB90 历史战役（1600-1973）和 UCDP 当代冲突（1989-2025）双模式切换。

> **GitHub Page**: [https://ilovedianaforever.github.io/war-shape](https://ilovedianaforever.github.io/war-shape)  
> **仓库**: [https://github.com/ilovedianaforever/war-shape](https://github.com/ilovedianaforever/war-shape)
---

## 一、项目简介

战争的形状 (War Shape) 是一个交互式战争与冲突时空可视化 Web 应用，支持 CDB90 历史战役（1600-1973）和 UCDP 当代冲突（1989-2025）双模式切换。核心功能包括：

- **暗色主题世界地图**：使用 CartoDB Dark Matter 免费瓦片服务
- **CDB90 + UCDP 双模式**：历史战争（1600-1973）与当代冲突（1989-2025）一键切换
- **时间轴动画**：年份/世纪滑块 + 播放/暂停，自动逐帧推进，速度可调
- **闪点时间序列动画**：Canvas 2D 脉冲光点依序在战场坐标爆炸，带伤疤累积层
- **3D 伤亡柱体**：deck.gl ColumnLayer，同坐标自动累加，高度幂函数缩放
- **H3 六边形密度网格**：H3 分辨率 3 六边形聚合冲突密度
- **流向弧线 + 粒子动画**：Canvas 粒子从攻方国家流向战场，支持贝塞尔/大圆双模式
- **GPU 加速散点**：deck.gl ScatterplotLayer 百万级散点渲染
- **国家边界动态高亮**：点击事件自动着色参战方国家边界并缩放
- **热力图层**：一键切换密度热力图
- **地区多选筛选**：非洲/中东/亚洲/欧洲/美洲/大洋洲
- **数据看板**：右侧折叠式 Recharts 图表面板（4 摘要卡 + 4 图 + Top 10）
- **事件详情弹窗**：点击任意点查看详情

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Next.js 16 (App Router) + React 19 | TypeScript |
| **地图库** | MapLibre GL JS v5.18 | 开源 Mapbox 替代品，GPU 渲染 |
| **3D 可视化** | deck.gl v9 + h3-js v4 | ColumnLayer / ArcLayer / H3HexagonLayer / ScatterplotLayer / GreatCircleLayer |
| **图表** | Recharts v2 | 数据看板（柱状图、饼图、折线图） |
| **地图样式** | CartoDB Dark Matter | 暗色主题，完全免费，无需 API Key |
| **UI 框架** | Tailwind CSS v4 | 玻璃拟态 (Glassmorphism) 暗色 UI |
| **图标** | Lucide React | 开源图标库 |
| **数据源** | CDB90 + UCDP GED v25.1 | 历史战役 + 当代冲突数据，免费公开 |

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
├── README.md                 # 本文档
├── public/
│   └── data/
│       ├── battle_events.json   # CDB90 历史战役全量数据（1600-1973）
│       ├── countries.json       # 世界国家边界 GeoJSON（MultiPolygon）
│       └── ucdp/                # UCDP 冲突年份分片（1989-2025，37 个 JSON）
├── src/
│   ├── app/
│   │   ├── layout.tsx        # 根布局（标题、字体、元数据）
│   │   ├── page.tsx          # 主页面（组合所有组件）
│   │   ├── globals.css       # 全局样式（暗色主题、玻璃态、自定义滑块/复选框）
│   │   └── api/conflicts/
│   │       └── route.ts      # API 路由（代理 UCDP API，加缓存）
│   ├── components/
│   │   ├── ConflictMap.tsx   # 核心地图组件（子叠加层集成、国家高亮、相机控制）
│   │   ├── Sidebar.tsx       # 侧边栏控制面板（双模式、7 层开关、筛选）
│   │   ├── FlashOverlay.tsx  # 闪点时间序列动画叠加层
│   │   ├── ArcFlowOverlay.tsx # 流向弧线粒子动画叠加层
│   │   ├── DeckGlOverlay.tsx # deck.gl 3D 图层集成
│   │   ├── DataPanel.tsx     # 数据看板（摘要卡 + 图表面板）
│   │   └── EventModal.tsx    # 事件详情弹窗
│   ├── services/
│   │   ├── conflictData.ts   # 数据服务（单例、双模式加载、缓存）
│   │   ├── countryCentroids.ts # 国家质心计算
│   │   └── sideCountryMap.ts # 参战方国名映射与内战检测
│   ├── lib/
│   │   └── basePath.ts       # 路径前缀工具（GitHub Pages）
│   └── types/
│       └── conflict.ts       # TypeScript 类型定义
```

---

## 五、核心文件说明

### 5.1 ConflictMap.tsx — 核心地图组件

整个项目的中枢，负责组合所有可视化模块：

- **底图**：CartoDB Dark Matter 免费暗色矢量瓦片（无需 API Key）
- **原生图层**：MapLibre GL 的 GeoJSON 散点图层（`conflicts-points`）和热力图层（`conflicts-heat`），自动按胜方/暴力类型着色
- **子叠加层集成**：挂载 FlashOverlay（闪点动画）、DeckGlOverlay（deck.gl 3D 图层）、ArcFlowOverlay（粒子弧线）三套独立渲染器
- **国家边界高亮**：点击事件后自动识别参战方国名（通过 `sideCountryMap`），在边界 Fill 层用红/蓝/紫色着色，并 fitBounds 动态缩放到战区
- **相机自适应**：柱体/弧线开启时自动倾斜 50° 俯角并启用旋转/俯仰交互

### 5.2 Sidebar.tsx — 侧边栏控制面板

- 数据模式切换：历史战争（CDB90，1600-1973） / 当代冲突（UCDP，1989-2025）
- 年份滑块 + 播放/暂停（战争模式支持世纪/5年段聚合）
- 7 种可视化图层独立开关：闪点动画、伤亡柱体、流向弧线、大圆弧线、GPU 散点、六边形网格
- 大圆弧线 / 贝塞尔弧线互斥切换
- 地区多选筛选（非洲/中东/亚洲/欧洲/美洲/大洋洲）
- 散点/热力图视图切换、播放速度调节

### 5.3 conflictData.ts — 数据服务

单例模式服务类：
- 战争模式：一次性全量加载 `battle_events.json`，支持精确年份、世纪/5年段聚合筛选
- 冲突模式：按需加载 UCDP 年份分片（`public/data/ucdp/{year}.json`），带内存缓存
- 世纪进度跳转：1600→1700→1800→1900→1905→1910→...
- 通用：地区筛选、日期排序、统计计算

### 5.4 route.ts — API 路由

Next.js API 路由，代理转发到 UCDP API，添加 24 小时服务器端缓存（数据已预置到本地，此路由保留供在线刷新使用）。

### 5.5 FlashOverlay.tsx — 闪点时间序列动画

纯 Canvas 2D 驱动的高性能时间序列动画层（避免 React 渲染抖动）：

- 按日期排序依序在战场坐标上产生脉冲光点（出生→膨胀→消退，生命周期 300ms）
- 战争模式按胜负着色（攻粉/守蓝/平黄），冲突模式按暴力类型着色（国家间=橙/非国家=紫/单方面=红）
- **伤疤累积层**：独立 Canvas，已播事件在地图上留下半永久淡色标记，全量重绘
- 速度自适应：战争模式 120 闪点/秒，冲突模式 200 闪点/秒
- 重叠坐标通过黄金角径向微偏移避免堆叠不可见

### 5.6 ArcFlowOverlay.tsx — 流向弧线粒子动画

Canvas 粒子沿攻击路径流动：

- 从攻方国家质心（由 `countryCentroids.ts` 计算）到战场坐标绘制贝塞尔曲线或大圆航线
- 每条弧线附着 2 个循环粒子，颜色按伤亡对数映射（少→浅橙，多→深红）
- 大圆模式：球面线性插值（slerp）生成 16 个采样点，粒子沿折线插值运动
- 跟随地图移动/缩放实时重投影（监听 `move` 事件重建所有路径）

### 5.7 DeckGlOverlay.tsx — deck.gl 3D 图层集成

通过 `@deck.gl/mapbox` 的 MapboxOverlay 注入 MapLibre GL，集成 5 种图层：

- **ColumnLayer**：3D 伤亡柱体，同坐标自动累加，高度按 `log10(c)^2.2 × 3000` 幂函数缩放（"一飞冲天"）
- **ArcLayer / GreatCircleLayer**：流向弧线，支持贝塞尔和大圆双模式
- **H3HexagonLayer**：H3 分辨率 3（边长约 60km）六边形密度聚合，按累积伤亡着色
- **ScatterplotLayer**：GPU 加速百万级散点（可替代 FlashOverlay 的 Canvas 闪点动画）
- 播放模式支持柱体高度平滑过渡动画

### 5.8 DataPanel.tsx — 右侧数据看板

基于 Recharts 的固定侧边数据看板，可折叠/展开：

- 4 张摘要卡片：事件数、总死亡数、涉及国家数、平均伤亡率
- 4 类可视图表：地区水平柱状图、胜负/暴力类型环形饼图、死亡趋势折线图、国家 Top 10 排行条
- 战争模式按世纪/5年段聚合趋势，冲突模式逐年
- 移动端浮动按钮适配

### 5.9 countryCentroids.ts — 国家质心计算

从 `public/data/countries.json` 的 MultiPolygon 所有坐标算术平均计算各国几何中心，用于弧线起点定位。提供同步版 `computeCentroidsSync` 供 React 初始化使用，带结果缓存。

### 5.10 sideCountryMap.ts — 参战方国名映射

CDB90 战役数据的参战方名标准化：

- 西班牙语→英语国名映射表（如 `Francia → France`）
- 历史帝国→现代继承国映射（奥斯曼→土耳其、阿兹特克→墨西哥、神圣罗马→德国 等）
- 模糊子串匹配（处理 "Government of X"、"Forces of Y" 等复合名）
- 内战检测（双方映射到同一国家时返回 `isCivil = true`）

### 5.11 basePath.ts — 路径工具

自动检测运行环境（`next.config.ts` 中的 `basePath`），在静态资源路径前添加 `/war-shape` 前缀，确保 GitHub Pages 部署路径正确。

---

## 六、许可

MIT License。