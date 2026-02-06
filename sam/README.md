# SAM 实践项目文档

> 从原理到实践，全面掌握 SAM 系列模型

---

## 文档导航

### 📚 核心文档（按顺序阅读）

```
1. 00-SAM核心原理.md
   └─ 理解 SAM 的工作原理和数据流
      - Encoder/Embedding/Decoder 是什么？
      - SAM1/2/HQ vs SAM3 的架构差异
      - 为什么分两/三阶段？
      
2. 01-SAM模型演进.md
   └─ SAM1、SAM2、SAM-HQ、SAM3 完整对比
      - 各模型规格、性能、特性
      - 如何选择模型？
      - 快速上手代码示例
      
3. 02-实践架构选择.md
   └─ 纯前端、纯后端、混合模式详解
      - 三种模式的完整实现
      - 性能对比与选择指南
      - 生产级代码示例
```

---

## 快速开始

### 5分钟理解 SAM

```
SAM 做什么？
  输入: 一张图 + 提示（点/框/文字）
  输出: 分割掩码

核心优势？
  通用性强，无需针对特定场景训练

工作流程？
  图片 → Encoder → Embedding → Decoder + 提示 → Mask
         (慢，1次)    (缓存)     (快，多次)
```

### 模型选择速查

```
场景                      推荐模型              理由
────────────────────      ────────────          ────────────
快速体验/前端部署          SAM2 tiny/small       小(39MB)、快、有ONNX
高精度抠图/边缘质量        SAM-HQ vit_h          边缘最好、透明物优秀
视频分割/实时追踪          SAM2 large            Memory模块、帧间一致
语义搜索/批量标注          SAM3                  文本提示、开放词汇
学习与实践（本项目）       SAM2 + SAM-HQ + SAM3  观察差异、全面掌握
```

### 架构选择速查

```
模式          特点                               适用场景
──────        ────────────────────────           ────────────────
纯前端        完全离线，首次加载慢               个人工具、隐私敏感
纯后端        高精度，每次点击都请求             批量处理、SAM3文本提示
混合模式⭐    大模型质量+快速交互                生产环境、交互式应用
```

---

## 项目支持的功能

### ✅ 已支持

- [x] SAM1 全系列 (vit_b / vit_l / vit_h)
- [x] SAM2 全系列 (tiny / small / base+ / large)
- [x] SAM-HQ 全系列 (vit_b / vit_l / vit_h)
- [x] SAM3 (848M 统一模型)
- [x] 纯前端模式 (ONNX.js)
- [x] 纯后端模式 (PyTorch)
- [x] 混合模式 (后端Encoder + 前端Decoder)
- [x] 点击提示
- [x] 边界框提示
- [x] 文本提示 (SAM3)
- [x] 示例提示 (SAM3)

### 🔜 计划中

- [ ] 视频分割实践
- [ ] 自动掩码生成
- [ ] 多模型实时对比
- [ ] 性能基准测试
- [ ] Embedding 缓存优化

---

## 技术栈

```
前端:
- TypeScript
- React
- ONNX Runtime Web
- Canvas API

后端:
- Python 3.12
- FastAPI
- PyTorch 2.0+
- SAM 官方库

部署:
- Docker
- Docker Compose
- Nginx (可选)
```

---

## 文档结构

```
sam/
├── README.md                    # 当前文件，文档导航
├── 00-SAM核心原理.md            # 必读，理解原理
├── 01-SAM模型演进.md            # 模型对比与选择
└── 02-实践架构选择.md           # 部署架构详解
```

---

## 常见问题

### Q1: SAM 有几个 Encoder？

```
答: 只有 1 个 Image Encoder

不同版本只是"规格"不同:
- SAM1: ViT-B/L/H (91M / 308M / 636M)
- SAM2: Hiera-T/S/B+/L (39M / 46M / 81M / 224M)
- SAM-HQ: ViT-B/L/H (同SAM1，加了HQ头)
- SAM3: ViT-L/14 (300M 视觉编码器)
```

### Q2: Embedding 是什么？

```
答: 图片的"特征压缩包"

原图 [1024, 768, 3] 
  → Encoder → 
Embedding [1, 256, 64, 64]

虽然数据变少了，但包含了图片的语义信息
可以缓存和传输
```

### Q3: 为什么要分两阶段？

```
答: 因为特性不同

             Encoder      Decoder
             ───────      ───────
计算量        很大          很小
频率          每图1次       每点击1次
可缓存        ✅           ❌

策略: Encoder跑一次缓存，Decoder每次点击都跑
```

### Q4: SAM3 和 SAM2 的主要区别？

```
SAM2:
- 视觉提示（点/框/Mask）
- 视频分割
- Hiera 编码器（快6倍）

SAM3:
- ⭐ 文本提示 ("a dog")
- ⭐ 示例提示（框一个找全部）
- ⭐ 开放词汇 (270K概念)
- ViT-L/14 + DETR Detector
- 模型更大 (848M)
```

### Q5: 哪个模式最适合生产环境？

```
答: 混合模式

理由:
✅ 后端用大模型 (ViT-H) → 高质量
✅ 前端本地解码 (50ms) → 流畅交互
✅ Embedding 只传一次 → 节省带宽

限制:
⚠️ 不支持 SAM3 的文本提示
   (SAM3 的 Detector 无法拆分)
```

---

## 学习路径

### 路径 1: 快速上手（1小时）

```
1. 阅读 00-SAM核心原理.md (20分钟)
2. 选择 SAM2 tiny (15分钟)
3. 运行纯前端 Demo (25分钟)
```

### 路径 2: 全面掌握（1天）

```
上午:
1. 精读 00-SAM核心原理.md
2. 精读 01-SAM模型演进.md
3. 实践: 对比 SAM1/SAM2/SAM-HQ

下午:
4. 精读 02-实践架构选择.md
5. 实践: 实现三种架构模式
6. 实践: 性能对比测试
```

### 路径 3: 深度实践（3天）

```
Day 1: 理论 + SAM1/SAM2
- 核心原理
- 模型对比
- 纯前端/纯后端实现

Day 2: SAM-HQ + 混合架构
- 高质量分割
- Embedding 传输优化
- 生产级混合架构

Day 3: SAM3 + 综合应用
- 文本提示分割
- 多模型实时对比
- 性能基准测试
```

---

## 贡献指南

欢迎提交 Issue 和 PR！

改进方向:
- 文档错误修正
- 代码示例优化
- 新功能实践
- 性能优化方案

---

## 参考资源

### 官方资源

- [SAM1 论文](https://arxiv.org/abs/2304.02643)
- [SAM1 GitHub](https://github.com/facebookresearch/segment-anything)
- [SAM2 GitHub](https://github.com/facebookresearch/sam2)
- [SAM3 官网](https://ai.meta.com/sam3/)
- [SAM3 GitHub](https://github.com/facebookresearch/sam3)
- [SAM-HQ GitHub](https://github.com/SysCV/sam-hq)

### 相关技术

- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [PyTorch 官网](https://pytorch.org/)

---

## 许可证

MIT License

---

**祝学习愉快！🚀**
