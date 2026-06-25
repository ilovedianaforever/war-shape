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

## 六、许可

MIT License。