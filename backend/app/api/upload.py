"""图片上传 API"""

import os
import uuid
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    上传图片，返回可访问的 URL
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        return JSONResponse(status_code=400, content={"detail": "仅支持图片文件"})

    # 生成文件名
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # 保存文件
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "filename": filename,
        "url": f"/uploads/{filename}",
        "size": len(content),
    }
