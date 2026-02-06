"""模型管理器基类"""

from abc import ABC, abstractmethod
from typing import Tuple
import numpy as np


class BaseModelManager(ABC):
    """
    所有 SAM 模型管理器的基类
    定义统一接口: 加载、编码、分割
    """

    def __init__(self):
        self.model = None
        self.predictor = None
        self.is_loaded = False
        self._model_id = ""

    @property
    def model_id(self) -> str:
        return self._model_id

    @abstractmethod
    def load_model(self, checkpoint_path: str, **kwargs) -> None:
        """加载模型权重"""
        pass

    @abstractmethod
    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        """
        生成图片 Embedding
        输入: image [H, W, 3] RGB
        输出: embedding [1, 256, 64, 64]
        """
        pass

    @abstractmethod
    def segment(
        self,
        image: np.ndarray,
        points: np.ndarray,
        labels: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        点击分割
        输入: image [H,W,3], points [N,2], labels [N]
        输出: (masks [3,H,W], scores [3])
        """
        pass

    def cleanup(self):
        """释放资源"""
        self.model = None
        self.predictor = None
        self.is_loaded = False
