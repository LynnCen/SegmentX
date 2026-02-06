# SegmentX

> SAM 学习实践平台 - 支持 SAM1/SAM2/SAM-HQ/SAM3

## 项目简介

SegmentX 是一个个人学习项目，用于深度实践 SAM (Segment Anything Model) 系列模型。

支持三种架构模式:
- **纯前端模式** - ONNX.js 浏览器推理
- **纯后端模式** - PyTorch GPU 推理
- **混合模式** - 后端 Encoder + 前端 Decoder

支持四代模型:
- **SAM1** - 经典版本 (vit_b / vit_l / vit_h)
- **SAM2** - 速度优化 + 视频 (tiny / small / base+ / large)
- **SAM-HQ** - 高质量边缘 (vit_b / vit_l / vit_h)
- **SAM3** - 文本提示 + 开放词汇

## 快速开始

### 1. 安装依赖

```bash
# 前端
cd frontend
pnpm install

# 后端
cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 下载模型

```bash
bash scripts/download-models.sh
```

### 3. 启动开发环境

```bash
bash scripts/dev.sh

# 或者分别启动:
# 后端
cd backend && uvicorn app.main:app --reload --port 8000

# 前端
cd frontend && pnpm dev
```

### 4. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000/docs

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 + Vite + Pinia + TypeScript |
| 前端推理 | ONNX Runtime Web |
| 后端 | Python + FastAPI |
| 后端推理 | PyTorch |
| 模型 | SAM1 / SAM2 / SAM-HQ / SAM3 |

## 项目结构

```
SegmentX/
├── frontend/           # Vue 3 前端
│   ├── src/
│   │   ├── modes/      # 三种模式实现
│   │   ├── components/ # UI 组件
│   │   ├── stores/     # Pinia 状态
│   │   └── core/       # 核心类型和工具
│   └── public/models/  # ONNX 模型
├── backend/            # Python 后端
│   ├── app/
│   │   ├── api/        # API 路由
│   │   ├── models/     # 模型管理器
│   │   └── core/       # 核心功能
│   └── models/         # PyTorch 模型文件
├── sam/                # 学习文档
└── scripts/            # 工具脚本
```

## 学习文档

详见 [sam/README.md](./sam/README.md)

## License

MIT
