"""请求模型定义"""

from pydantic import BaseModel


class PointInput(BaseModel):
    x: float
    y: float
    type: int  # 0=背景, 1=前景


class SegmentRequest(BaseModel):
    """纯后端分割请求"""
    image_url: str
    points: list[PointInput]
    model: str = "sam1_vit_b"


class EmbeddingRequest(BaseModel):
    """混合模式 - Embedding 请求"""
    image_url: str
    model: str = "sam1_vit_b"


class TextSegmentRequest(BaseModel):
    """SAM3 文本分割请求"""
    image_url: str
    prompt: str
    confidence: float = 0.5
