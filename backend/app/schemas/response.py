"""响应模型定义"""

from pydantic import BaseModel


class ModelInfo(BaseModel):
    """模型信息"""
    id: str
    family: str
    checkpoint: str
    is_loaded: bool


class SegmentResponse(BaseModel):
    """分割结果"""
    mask: str  # base64 PNG 图片
    mask_size: list[int]  # [H, W]
    score: float
    time_ms: float
    model: str


class EmbeddingResponse(BaseModel):
    """Embedding 结果"""
    embedding: str  # base64(gzip(float32))
    shape: list[int]
    original_size: list[int]
    compressed_size: int
    model: str


class TextSegmentResponse(BaseModel):
    """文本分割结果"""
    masks: list[str]  # base64 PNG 的 masks
    scores: list[float]
    boxes: list[list[float]]
    count: int
    time_ms: float
