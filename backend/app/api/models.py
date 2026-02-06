"""模型管理 API"""

from fastapi import APIRouter
from ..schemas.response import ModelInfo
from ..models.registry import model_registry
from ..config import settings

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """列出所有可用模型及其状态"""
    loaded = model_registry.list_loaded()

    return [
        ModelInfo(
            id=model_id,
            family=config["family"],
            checkpoint=config["checkpoint"],
            is_loaded=model_id in loaded,
        )
        for model_id, config in settings.available_models.items()
    ]


@router.post("/models/{model_id}/load")
async def load_model(model_id: str):
    """手动加载指定模型"""
    try:
        model_registry.load(model_id)
        return {"status": "ok", "model": model_id}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.post("/models/{model_id}/unload")
async def unload_model(model_id: str):
    """卸载指定模型"""
    model_registry.unload(model_id)
    return {"status": "ok", "model": model_id}
