# SegmentX 文档中心

---

## 📚 文档结构

```
docs/
├── README.md                              ← 你在这里
├── learning/                              ← SAM 学习与实践
│   ├── 00-SAM核心原理.md                  数据流、Encoder/Embedding/Decoder
│   ├── 01-SAM模型演进.md                  SAM1 → SAM2 → SAM-HQ → SAM3
│   ├── 02-实践架构选择.md                  纯前端 / 纯后端 / 混合模式
│   ├── 03-实践项目架构设计.md              项目架构、目录结构、设计模式
│   ├── 04-实施计划.md                     7天分步实施指南
│   └── 05-纯后端模式实现详解.md            从一张图片到 Mask 的完整流程
└── reference/                             ← 前端参考文档 (@lego/sam)
    ├── SAM前端深度解析.md                  RLE解码、Canvas绘制、ONNX推理
    ├── SAM前端实践指南.md                  @lego/sam 包架构与使用
    └── AutoMaskModel深度解析.md            自动分割图层选择系统
```

---

## 🎯 阅读路径

### 从零学习 SAM

```
1. learning/00-SAM核心原理.md        → 理解 SAM 做什么、数据怎么流转
2. learning/01-SAM模型演进.md        → SAM1/2/HQ/3 各有什么区别
3. learning/02-实践架构选择.md        → 三种部署模式如何选择
4. learning/05-纯后端模式实现详解.md  → 从图片到 Mask 的关键代码走读
```

### 动手实践

```
1. learning/03-实践项目架构设计.md    → 整体技术方案
2. learning/04-实施计划.md           → Day 1~7 逐步实现
```

### 深入前端实现

```
1. reference/SAM前端实践指南.md      → @lego/sam 的架构和使用
2. reference/SAM前端深度解析.md      → RLE、Canvas、ONNX 原理
3. reference/AutoMaskModel深度解析.md → 图层选择的核心算法
```

---

## 📖 文档说明

| 目录 | 内容 | 面向 |
|------|------|------|
| `learning/` | 本项目的 SAM 学习文档，从原理到实践 | 想学习 SAM 的开发者 |
| `reference/` | 已有 @lego/sam 前端包的技术文档 | 需要了解前端 SAM 集成细节的开发者 |
