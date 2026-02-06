"""分割 API (纯后端模式)"""

import time
import base64
from io import BytesIO
import numpy as np
from PIL import Image
from fastapi import APIRouter, HTTPException

from ..schemas.request import SegmentRequest
from ..schemas.response import SegmentResponse
from ..models.registry import model_registry
from ..core.image_loader import load_image

router = APIRouter(prefix="/api", tags=["segment"])


def mask_to_base64_png(mask: np.ndarray) -> str:
    """将二值 mask 转为半透明蓝色 PNG 的 base64"""
    h, w = mask.shape
    # RGBA: 半透明蓝色
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[mask > 0] = [30, 144, 255, 128]  # 蓝色半透明

    img = Image.fromarray(rgba, 'RGBA')
    buf = BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')


@router.post("/segment", response_model=SegmentResponse)
async def segment(request: SegmentRequest):
    """
    纯后端分割
    Encoder + Decoder 都在服务器执行
    返回 base64 PNG 格式的 mask
    """
    start_time = time.time()

    try:
        # 1. 加载图片
        image = await load_image(request.image_url)

        # 2. 获取/加载模型
        manager = model_registry.get_or_load(request.model)

        # 3. 准备点击
        points = np.array([[p.x, p.y] for p in request.points])
        labels = np.array([p.type for p in request.points])

        # 4. 分割
        masks, scores = manager.segment(image, points, labels)

        # 5. 选择最佳 mask
        best_idx = int(np.argmax(scores))
        best_mask = masks[best_idx]

        # 6. 转为 base64 PNG
        mask_b64 = mask_to_base64_png(best_mask)

        elapsed_ms = (time.time() - start_time) * 1000
        print(f"[Segment] {request.model} 耗时: {elapsed_ms:.0f}ms, score: {scores[best_idx]:.4f}")

        return SegmentResponse(
            mask=mask_b64,
            mask_size=[best_mask.shape[0], best_mask.shape[1]],
            score=float(scores[best_idx]),
            time_ms=elapsed_ms,
            model=request.model,
        )

    except ImportError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="模型权重未找到，请先下载模型"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
