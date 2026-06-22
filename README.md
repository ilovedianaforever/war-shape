# 战争的形状 (War Shape)

基于 CDB90 历史战役数据集与 UCDP 当代冲突数据的交互式时空可视化。600+ 场历史战役 + 38.5 万条当代冲突事件，通过暗色地图、时间轴动画、3D 柱体、流向弧线与六边形密度网格呈现战争的空间扩散与伤痕累积。

## Features

### 🗺️ **Interactive World Map**
- Dark-themed world map using MapLibre GL JS with free CartoDB tiles
- Smooth pan, zoom, and rotation controls
- High-performance rendering with deck.gl

### 📊 **Data Visualization**
- **Color-coded events**: 
  - 🔴 Red = State-based violence
  - 🟠 Orange = Non-state violence  
  - 🟡 Yellow = One-sided violence
- **Proportional sizing**: Dot size reflects casualty count
- **Two view modes**: Individual events or density heatmap

### ⏱️ **Timeline Controls**
- Interactive timeline slider (1989-2024)
- Auto-play animation with year-by-year progression
- Real-time filtering by year

### 🌍 **Regional Filtering**
- Filter by geographic regions:
  - Africa
  - Middle East
  - Asia  
  - Europe
  - Americas
- Multi-select with instant visual feedback

### 📈 **Live Statistics**
- Total events and casualties for selected timeframe
- Top 5 deadliest conflicts ranking
- Real-time updates as you filter

### 🖱️ **Interactive Event Details**
- Click any conflict point for detailed popup
- Shows parties involved, date, location, casualties
- Source attribution and technical details

## Technology Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development  
- **MapLibre GL JS** - Free alternative to Mapbox
- **deck.gl** - High-performance data visualization
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons

## Data Source

All conflict data is sourced from the **Uppsala Conflict Data Program (UCDP)** via their free public API:

- **Endpoint**: `https://ucdpapi.pcr.uu.se/api/gedevents/25.1`
- **Dataset**: UCDP Georeferenced Event Dataset v25.1
- **Coverage**: 385,000+ georeferenced conflict events
- **Timespan**: 1989-2024
- **Updates**: Real-time API calls with intelligent caching

### Violence Types
1. **State-based**: Conflicts between governments and rebel groups
2. **Non-state**: Conflicts between non-governmental groups  
3. **One-sided**: Violence against civilians

## Installation

```bash
# 进入项目目录
cd war-shape

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Deployment

### Vercel (Recommended)
```bash
npm run build
vercel deploy
```

### Docker
```bash
# Build image
docker build -t war-shape .

# Run container
docker run -p 3000:3000 war-shape
```

## Performance Optimizations

- **Smart caching**: API responses cached in memory
- **Lazy loading**: Historical data loaded progressively
- **Recent priority**: 2020-2024 data pre-fetched for instant display
- **Pagination handling**: Automatic multi-page API fetching
- **Client-side rendering**: Map components dynamically imported

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive design)

## API Rate Limiting

The UCDP API is free but please be respectful:
- Built-in 100ms delay between paginated requests
- Intelligent caching to minimize redundant calls
- Consider running your own data mirror for high-traffic usage

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Data Attribution

**Uppsala Conflict Data Program (UCDP)**  
Department of Peace and Conflict Research  
Uppsala University  

Please cite UCDP when using this visualization:
> Sundberg, Ralph, and Erik Melander. "Introducing the UCDP Georeferenced Event Dataset." *Journal of Peace Research* 50.4 (2013): 523-532.

## Acknowledgments

- Uppsala Conflict Data Program for providing free conflict data
- MapLibre community for open-source mapping tools
- deck.gl team for high-performance visualization framework
- CartoDB for free map tiles

---

**Built with ❤️ for peace research and data visualization**