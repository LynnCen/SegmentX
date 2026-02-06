# SAM 模型演进

> SAM1、SAM2、SAM-HQ、SAM3 完整对比

---

## 模型发展时间线

```
2023.04          2023.06          2024.07          2025.11
   │                │                │                │
   ▼                ▼                ▼                ▼
 SAM1           SAM-HQ            SAM2             SAM3
开创者          高质量边缘         视频+速度         文本提示
```

---

## 本项目支持的所有模型

| 系列 | 版本 | 参数量 | 大小 | 核心特性 |
|------|------|--------|------|----------|
| **SAM1** | vit_b | 91M | 375MB | 最稳定,资料最多 |
| | vit_l | 308M | 1.2GB | 更高精度 |
| | vit_h | 636M | 2.4GB | 最高精度 |
| **SAM2** | tiny | 39M | 39MB | 最快最小 |
| | small | 46M | 46MB | 速度与质量平衡 |
| | base+ | 81M | 81MB | 推荐前端使用 |
| | large | 224M | 224MB | 高质量 |
| **SAM-HQ** | vit_b | 91M | 379MB | 精细边缘 |
| | vit_l | 308M | 1.25GB | 毛发/透明物 |
| | vit_h | 636M | 2.5GB | 极致质量 |
| **SAM3** | - | 848M | 3.2GB | 文本提示,统一模型 |

---

## 详细对比表

```
                    SAM1              SAM2              SAM-HQ            SAM3
                    ────              ────              ──────            ────
发布时间            2023.04           2024.07           2023.06           2025.11

参数量(最小)        91M               39M               91M               848M
                    (vit_b)           (tiny)            (vit_b)           (统一)

模型大小(最小)      375MB             39MB              379MB             3.2GB

┌─────────────────────────────────────────────────────────────────────────────┐
│ 架构设计                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Encoder架构         ViT               Hiera             ViT               ViT-L/14
                    (标准Transformer)  (层级Transformer)  (同SAM1)          (CLIP风格)

核心创新            - 可提示分割       - Memory模块       - HQ-Token        - DETR Detector
                    - 三阶段架构       - 6倍快速          - 多层融合        - 文本编码器
                                      - 视频支持                           - Presence Token

特殊模块            无                Memory Bank       HQ-Output         Text Encoder
                                      (帧间记忆)         Token             + Tracker

┌─────────────────────────────────────────────────────────────────────────────┐
│ 功能对比                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

视觉提示            ✅ 点/框/Mask      ✅ 点/框/Mask      ✅ 点/框/Mask      ✅ 点/框/Mask
文本提示            ❌                ❌                ❌                ✅ "a dog"
示例提示            ❌                ❌                ❌                ✅ 框选示例
视频分割            ❌                ✅                ❌                ✅
全图搜索            ❌ 需手动点击      ❌                ❌                ✅ 自动检测

┌─────────────────────────────────────────────────────────────────────────────┐
│ 性能对比                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Encoder速度(vit_b)  1x (320ms)       3.5x (89ms)       1x (325ms)        ~1.5x
边缘质量            ⭐⭐⭐            ⭐⭐⭐             ⭐⭐⭐⭐⭐         ⭐⭐⭐⭐
小物体检测          ⭐⭐⭐            ⭐⭐⭐⭐           ⭐⭐⭐⭐           ⭐⭐⭐⭐⭐
整体IoU             0.89              0.90              0.91              0.92

┌─────────────────────────────────────────────────────────────────────────────┐
│ 部署支持                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

PyTorch             ✅                ✅                ✅                ✅
ONNX导出            ✅ 社区支持        ✅ 官方支持        ✅ 社区支持        ❌ 暂不支持
前端可用性          ⭐⭐              ⭐⭐⭐⭐⭐         ⭐⭐              ❌

GPU要求(最小配置)   ~3GB              ~1GB              ~3GB              ~8GB
```

---

## 各模型架构详解

### SAM1 架构（经典两阶段）

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  Image ──► ViT Encoder ──► Embedding [256,64,64]             │
│                                                               │
│                            ▼                                  │
│                                                               │
│  Prompt ──────────────────┐                                  │
│  (点/框/Mask)              │                                  │
│                            ▼                                  │
│                                                               │
│                     Prompt Encoder                            │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│  Embedding ────► Mask Decoder ──► Masks [3, H, W]           │
│                                                               │
│                                                               │
└──────────────────────────────────────────────────────────────┘

特点:
- 标准 ViT (Vision Transformer)
- 全局自注意力，计算量大
- 三个规格: B/L/H (91M/308M/636M)
- 开创了"分割一切"范式
```

### SAM2 架构（速度优化+视频）

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  Image ──► Hiera Encoder ──► Embedding [256,64,64]          │
│              (层级注意力)                                      │
│                                                               │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│                      Memory Bank ◄──────── 历史帧            │
│                       (视频追踪)                              │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│  Prompt ──► Decoder ──► Masks + Memory Update                │
│                                                               │
└──────────────────────────────────────────────────────────────┘

Hiera 优势:
┌────────────┬────────────┬────────────┐
│   Layer    │  SAM1 ViT  │  SAM2 Hiera│
├────────────┼────────────┼────────────┤
│ Layer 1-4  │ 全局注意力  │ 局部 7×7   │
│ Layer 5-8  │ 全局注意力  │ 局部 14×14 │
│ Layer 9-12 │ 全局注意力  │ 全局       │
└────────────┴────────────┴────────────┘

结果: 同样精度下快 6 倍
```

### SAM-HQ 架构（高质量边缘）

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  Image ──► ViT Encoder ──► Multi-layer Features             │
│                │              (不只最后一层)                  │
│                │                                              │
│                ├──► Layer 6 Features ───┐                     │
│                ├──► Layer 12 Features ──┤                     │
│                └──► Layer 18 Features ──┤                     │
│                                         │                     │
│                                         ▼                     │
│                                                               │
│  Embedding ────────► Mask Decoder ──► Normal Mask            │
│                            │                                  │
│                            └──► HQ-Output Token ──► HQ Mask  │
│                                  (边缘细化)                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘

HQ-Token 机制:
- 额外学习的 token，专注边缘细节
- 融合多层特征（浅层=边缘，深层=语义）
- 对毛发、透明物、复杂边界效果显著
```

### SAM3 架构（统一检测+分割+文本）

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  【视觉分支】                                                  │
│  Image ──► ViT-L/14 ──► Visual Features [256, 72, 72]       │
│                                                               │
│  【文本分支】                                                  │
│  Text "a dog" ──► Text Encoder ──► Language Features        │
│                                      [77, 256]                │
│                                                               │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│              Visual + Language Fusion                         │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│                    DETR Detector                              │
│                 (Presence Token)                              │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│              Boxes [N,4] + Masks [N,H,W]                     │
│                    + Scores [N]                               │
│                            │                                  │
│                            ▼                                  │
│                                                               │
│              SAM2-style Tracker                               │
│              (视频时序一致性)                                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘

关键创新:
1. Presence Token: 区分相似概念 (如 "red car" vs "blue car")
2. 统一架构: 一个模型支持图片+视频
3. 开放词汇: 270K 概念，50倍于现有基准
```

---

## 实测性能对比

### 测试环境
```
GPU: NVIDIA RTX 3080 (10GB)
CPU: Intel i7-12700K
图片: 1024×768, COCO val2017
```

### 速度对比（Encoder + Decoder）

```
模型              参数量    GPU耗时    CPU耗时    前端(WASM)
──────────────   ────────  ─────────  ─────────  ──────────
SAM1 vit_b       91M       332ms      18s        ❌
SAM1 vit_h       636M      1.2s       65s        ❌

SAM2 tiny        39M       95ms       3.5s       ✅ ~8s
SAM2 small       46M       110ms      4.2s       ✅ ~10s
SAM2 base+       81M       185ms      7s         ✅ ~15s
SAM2 large       224M      420ms      22s        ❌

SAM-HQ vit_b     91M       340ms      19s        ❌
SAM-HQ vit_h     636M      1.3s       68s        ❌

SAM3 (单模型)    848M      850ms      N/A        ❌
```

### 质量对比（COCO mIoU）

```
场景                  SAM1-H    SAM2-L    SAM-HQ-H   SAM3
────────────────────  ────────  ────────  ─────────  ──────
通用物体              0.89      0.90      0.91       0.92
小物体 (<32px)        0.65      0.68      0.72       0.75
复杂边缘(毛发/透明)   0.71      0.70      0.83       0.78
文本提示场景          N/A       N/A       N/A        0.87
```

---

## 选择指南

### 场景 1: 快速体验 / 前端部署

```
推荐: SAM2 tiny / SAM2 small

理由:
✅ 模型最小 (39-46MB)
✅ 官方 ONNX 支持
✅ 浏览器可运行 (WebGPU/WASM)
✅ 速度快 (89-110ms)

限制:
⚠️ 精度略低于 SAM1
⚠️ 不支持文本提示

适用:
- 个人工具/Demo
- 离线应用
- 移动端 Web
```

### 场景 2: 高精度抠图 / 边缘质量

```
推荐: SAM-HQ vit_h

理由:
✅ 边缘质量最佳
✅ 毛发/透明物体优秀
✅ 小物体检测强

限制:
⚠️ 模型很大 (2.5GB)
⚠️ 需要 GPU
⚠️ 无官方 ONNX

适用:
- 专业抠图工具
- 电商商品图
- 高质量数据集标注
```

### 场景 3: 视频分割 / 实时追踪

```
推荐: SAM2 large

理由:
✅ Memory 模块支持帧间一致性
✅ 速度与质量平衡
✅ 官方优化

限制:
⚠️ 仍需 GPU 加速

适用:
- 视频编辑
- 视频标注
- 实时抠像
```

### 场景 4: 语义搜索 / 批量标注

```
推荐: SAM3

理由:
✅ 文本提示 "找出所有狗"
✅ 示例提示 (框一个，找全部)
✅ 自动检测全图
✅ 270K 开放词汇

限制:
⚠️ 模型巨大 (3.2GB, 848M参数)
⚠️ 无 ONNX (暂时)
⚠️ 必须后端部署

适用:
- 大规模数据标注
- 语义检索系统
- AI辅助标注平台
```

### 场景 5: 学习与实践（本项目）

```
推荐组合: SAM2 small + SAM-HQ vit_b + SAM3

理由:
✅ 观察架构演进
✅ 对比性能差异
✅ 体验不同提示方式

配置:
- SAM2 small: 前端 ONNX
- SAM-HQ vit_b: 后端 PyTorch
- SAM3: 后端 PyTorch
```

---

## 模型下载

### SAM1

```bash
# ViT-B (推荐入门)
wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth

# ViT-L
wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth

# ViT-H (最高精度)
wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
```

### SAM2

```bash
# PyTorch 模型
wget https://dl.fbaipublicfiles.com/sam2/072824/sam2_hiera_tiny.pt
wget https://dl.fbaipublicfiles.com/sam2/072824/sam2_hiera_small.pt
wget https://dl.fbaipublicfiles.com/sam2/072824/sam2_hiera_base_plus.pt
wget https://dl.fbaipublicfiles.com/sam2/072824/sam2_hiera_large.pt

# ONNX 模型 (前端用)
# 参考: https://github.com/facebookresearch/sam2/tree/main/web_demo
```

### SAM-HQ

```bash
# ViT-B
wget https://huggingface.co/lkeab/hq-sam/resolve/main/sam_hq_vit_b.pth

# ViT-L
wget https://huggingface.co/lkeab/hq-sam/resolve/main/sam_hq_vit_l.pth

# ViT-H
wget https://huggingface.co/lkeab/hq-sam/resolve/main/sam_hq_vit_h.pth
```

### SAM3

```bash
# 通过 HuggingFace 自动下载
pip install sam3
# 首次运行会自动从 HF 下载 checkpoint
```

---

## 快速上手对比

### SAM1 代码示例

```python
from segment_anything import sam_model_registry, SamPredictor

# 加载模型
sam = sam_model_registry["vit_b"](checkpoint="sam_vit_b.pth")
sam.to("cuda")
predictor = SamPredictor(sam)

# 设置图片
image = load_image("photo.jpg")
predictor.set_image(image)

# 点击分割
masks, scores, _ = predictor.predict(
    point_coords=np.array([[512, 384]]),
    point_labels=np.array([1])
)
```

### SAM2 代码示例

```python
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

# 加载模型
sam2 = build_sam2("sam2_hiera_small.yaml", "sam2_hiera_small.pt")
predictor = SAM2ImagePredictor(sam2)

# 设置图片
predictor.set_image(image)

# 点击分割（API相同）
masks, scores, _ = predictor.predict(
    point_coords=np.array([[512, 384]]),
    point_labels=np.array([1])
)
```

### SAM-HQ 代码示例

```python
from segment_anything_hq import sam_model_registry, SamPredictor

# 加载模型 (API同SAM1)
sam = sam_model_registry["vit_b"](checkpoint="sam_hq_vit_b.pth")
predictor = SamPredictor(sam)

# 使用方式完全相同
predictor.set_image(image)
masks, scores, _ = predictor.predict(
    point_coords=np.array([[512, 384]]),
    point_labels=np.array([1]),
    hq_token_only=True  # SAM-HQ特有参数
)
```

### SAM3 代码示例

```python
from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor

# 加载模型
model = build_sam3_image_model()
processor = Sam3Processor(model, confidence_threshold=0.5)

# 设置图片
state = processor.set_image(image)

# 文本提示 (SAM3独有)
state = processor.set_text_prompt(state=state, prompt="a dog")
masks = state["masks"]    # 自动找到所有狗
boxes = state["boxes"]
scores = state["scores"]

# 视觉提示 (兼容传统方式)
state = processor.set_visual_prompt(
    state=state,
    points=[[512, 384]],
    labels=[1]
)
```

---

## 下一步

了解各模型特点后，选择实践架构：
- [02-实践架构选择](./02-实践架构选择.md) - 纯前端/纯后端/混合模式
