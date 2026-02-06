"""Embedding API (混合模式)"""

import time
from fastapi import APIRouter, HTTPException

from ..schemas.request import EmbeddingRequest
from ..schemas.response import EmbeddingResponse
from ..models.registry import model_registry
from ..core.image_loader import load_image
from ..utils.compression import compress_embedding

router = APIRouter(prefix="/api", tags=["embedding"])


@router.post("/embedding", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    """
    生成图片 Embedding (混合模式)
    后端生成 Embedding，压缩后传给前端
    前端用 ONNX Decoder 做交互式解码
    """
    start_time = time.time()

    try:
        # 1. 加载图片
        image = await load_image(request.image_url)

        # 2. 获取/加载模型
        manager = model_registry.get_or_load(request.model)

        # 3. 生成 embedding
        embedding = manager.generate_embedding(image)

        # 4. 压缩
        result = compress_embedding(embedding)

        elapsed_ms = (time.time() - start_time) * 1000
        print(
            f"[Embedding] {request.model} 耗时: {elapsed_ms:.0f}ms, "
            f"原始: {result.raw_size/1024:.0f}KB → 压缩: {result.compressed_size/1024:.0f}KB "
            f"({result.ratio:.1%})"
        )

        return EmbeddingResponse(
            embedding=result.encoded,
            shape=list(embedding.shape),
            original_size=[image.shape[0], image.shape[1]],
            compressed_size=result.compressed_size,
            model=request.model,
        )

    except NotImplementedError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ImportError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
