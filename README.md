# Dot Loader Studio · 点阵加载动效编辑器

A visual editor for dot-matrix loading animations, the "AI is thinking" kind. Pick a preset or draw frame by frame, then export React, HTML or GIF.

**▶ 在线使用 / Live demo: https://uniqfroyo.github.io/dot-loader-studio/**

用来制作 “AI 正在思考” 那类点阵 loading 动效的编辑器。整个工具是一个 HTML 文件，没有任何依赖。

## 使用

直接用浏览器打开 `index.html`，或者起一个本地服务：

```bash
npx serve .
```

## 功能

**预设模式**
- 点击或拖拽格子，设置参与动画的区域；也可以用快速选区：全部、圆形、圆环、十字、X 形、菱形、边框、随机
- 19 种内置预设：涟漪、呼吸、波浪、斜扫、雷达、螺旋、贪吃蛇、进度条、星光、雨滴、均衡器、弹跳、扫描、风车、菱形扩散、棋盘、心跳、交错、噪点
- 可以调循环时长，也可以反向播放
- 「转为序列帧」可以把当前预设变成帧序列，再逐帧修改

**序列模式（像素画）**
- 工具：画笔、橡皮（也可以用右键）、填充；画笔有 3 档亮度
- 帧操作：新建、复制、删除、调整顺序、整体平移、反转、洋葱皮
- 可以从任意预设生成帧序列作为起点
- 快捷键：`Space` 播放，`← →` 切换帧，`B/E/G` 切换工具，`1/2/3` 选亮度，`N/D` 新建/复制帧，`⌘Z` 撤销

**样式**
- 网格：1–16 行 × 1–16 列，点大小和间距都能调
- 形状：圆形、圆角、方形、菱形、圆环、十字、六边形
- 颜色：纯色或渐变（横向、纵向、斜向、径向），背景色可调
- 效果：暗格亮度、发光、亮度缩放、隐藏暗格

**导出**
- React 组件（TSX）和原生 HTML/CSS/JS 片段，都不需要依赖，并且支持 `prefers-reduced-motion`
- GIF：1×–4× 尺寸，可以选透明背景（内置 GIF89a 编码器）
- JSON 项目文件：可以保存，之后再导入继续编辑

编辑进度会自动存到浏览器的 localStorage。

## License

MIT
