"""文本分割 API (SAM3 专用)"""

import time
from fastapi import APIRouter, HTTPException

from ..schemas.request import TextSegmentRequest
from ..schemas.response import TextSegmentResponse
from ..models.registry import model_registry
from ..models.sam3_manager import SAM3Manager
from ..core.image_loader import load_image
from ..utils.rle import encode_mask_rle

router = APIRouter(prefix="/api", tags=["text-segment"])


@router.post("/segment/text", response_model=TextSegmentResponse)
async def segment_text(request: TextSegmentRequest):
    """
    文本提示分割 (SAM3 独有)
    使用文字描述分割目标，如 "a dog"
    """
    start_time = time.time()

    try:
        # 1. 加载图片
        image = await load_image(request.image_url)

        # 2. 获取 SAM3 管理器
        manager = model_registry.get_or_load("sam3")
        if not isinstance(manager, SAM3Manager):
            raise HTTPException(
                status_code=400,
                detail="文本分割仅支持 SAM3 模型"
            )

        # 3. 文本分割
        masks, scores, boxes = manager.segment_text(
            image, request.prompt, request.confidence
        )

        # 4. 编码所有 masks
        masks_rle = [encode_mask_rle(m) for m in masks]

        elapsed_ms = (time.time() - start_time) * 1000

        return TextSegmentResponse(
            masks=masks_rle,
            scores=scores.tolist(),
            boxes=boxes.tolist(),
            count=len(masks),
            time_ms=elapsed_ms,
        )

    except ImportError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
