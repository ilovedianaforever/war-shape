import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "战争的形状 — 历史战役时空可视化",
  description: "基于CDB90历史战役数据集，将600余场战役转译为交互式时空伤痕，通过暗色地图、时间轴动画与数据可视化呈现战争在历史空间中的扩散与代价。",
  keywords: "战争可视化, 历史战役, 数据可视化, 时空数据, CDB90",
  openGraph: {
    title: "战争的形状 — 历史战役时空可视化",
    description: "600场历史战役的时空伤痕地图",
    type: "website",
    siteName: "战争的形状"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
