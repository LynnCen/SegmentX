"""SegmentX API 主应用"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .api import models, segment, embedding, text_segment, upload
from .models.registry import model_registry

# 上传目录
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    print(f"🚀 {settings.app_name} 启动中...")
    print(f"   Device: {settings.device}")
    print(f"   Models dir: {settings.models_dir}")
    print(f"   Available models: {list(settings.available_models.keys())}")
    print()
    print("💡 提示: 模型将在首次使用时按需加载")
    print("   也可手动加载: POST /api/models/<model_id>/load")
    print()
    print("✅ API 已就绪")
    print("   文档: http://localhost:8000/docs")

    yield

    print("🛑 正在关闭...")
    model_registry.unload_all()
    print("✅ 已清理所有模型")


app = FastAPI(
    title=settings.app_name,
    description="SAM 学习实践平台 API - 支持 SAM1/SAM2/SAM-HQ/SAM3",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件 - 上传的图片
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 注册路由
app.include_router(models.router)
app.include_router(segment.router)
app.include_router(embedding.router)
app.include_router(text_segment.router)
app.include_router(upload.router)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "models": "/api/models",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "loaded_models": model_registry.list_loaded(),
    }
