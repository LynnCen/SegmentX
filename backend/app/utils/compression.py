"""压缩工具"""

import gzip
import base64
import numpy as np


class CompressResult:
    """压缩结果"""
    def __init__(self, encoded: str, raw_size: int, compressed_size: int):
        self.encoded = encoded
        self.raw_size = raw_size
        self.compressed_size = compressed_size
        self.ratio = compressed_size / raw_size if raw_size > 0 else 0


def compress_embedding(embedding: np.ndarray) -> CompressResult:
    """将 numpy embedding 压缩为 base64 字符串"""
    raw_bytes = embedding.astype(np.float32).tobytes()
    compressed = gzip.compress(raw_bytes, compresslevel=6)
    encoded = base64.b64encode(compressed).decode("utf-8")

    return CompressResult(
        encoded=encoded,
        raw_size=len(raw_bytes),
        compressed_size=len(compressed),
    )


def decompress_embedding(encoded: str, shape: tuple) -> np.ndarray:
    """将 base64 字符串解压为 numpy embedding"""
    compressed = base64.b64decode(encoded)
    raw_bytes = gzip.decompress(compressed)
    return np.frombuffer(raw_bytes, dtype=np.float32).reshape(shape)
