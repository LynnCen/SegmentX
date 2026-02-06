"""图片加载工具"""

import os
import base64
import numpy as np
from PIL import Image
from io import BytesIO
import aiohttp

# uploads 目录路径
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


async def load_image(source: str) -> np.ndarray:
    """
    智能加载图片，支持:
    - /uploads/xxx  (本服务上传的文件)
    - HTTP/HTTPS URL
    - base64 data URL (data:image/...)
    - 本地文件路径
    """
    if source.startswith("/uploads/"):
        # 从本地 uploads 目录读取
        filename = source.replace("/uploads/", "")
        filepath = os.path.join(UPLOAD_DIR, filename)
        return load_image_from_file(filepath)
    elif source.startswith("data:image"):
        return load_image_from_base64(source)
    elif source.startswith(("http://", "https://")):
        return await load_image_from_url(source)
    else:
        return load_image_from_file(source)


async def load_image_from_url(url: str) -> np.ndarray:
    """从 URL 加载图片"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise ValueError(f"无法加载图片: HTTP {response.status}")

            image_bytes = await response.read()
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
            return np.array(image)


def load_image_from_base64(data_url: str) -> np.ndarray:
    """从 base64 data URL 加载图片"""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]

    image_bytes = base64.b64decode(data_url)
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    return np.array(image)


def load_image_from_file(file_path: str) -> np.ndarray:
    """从本地文件加载图片"""
    image = Image.open(file_path).convert("RGB")
    return np.array(image)
