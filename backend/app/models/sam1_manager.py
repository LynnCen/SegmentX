"""SAM1 模型管理器"""

from typing import Tuple
import numpy as np
from .base import BaseModelManager


class SAM1Manager(BaseModelManager):
    """
    SAM1 模型管理器
    使用 segment-anything 官方库
    """

    def load_model(self, checkpoint_path: str, model_type: str = "vit_b", device: str = "cpu") -> None:
        try:
            import torch
            from segment_anything import sam_model_registry, SamPredictor
        except ImportError:
            raise ImportError(
                "请安装 SAM1 依赖: pip install git+https://github.com/facebookresearch/segment-anything.git"
            )

        print(f"[SAM1] 加载 {model_type} from {checkpoint_path}...")

        sam = sam_model_registry[model_type](checkpoint=checkpoint_path)
        sam.to(device)
        sam.eval()

        self.model = sam
        self.predictor = SamPredictor(sam)
        self.is_loaded = True
        self._device = device

        print(f"[SAM1] ✅ {model_type} 加载完成 (device: {device})")

    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        if not self.is_loaded:
            raise RuntimeError("模型未加载")

        import torch

        with torch.no_grad():
            self.predictor.set_image(image)
            embedding = self.predictor.get_image_embedding()
            return embedding.cpu().numpy()

    def segment(
        self,
        image: np.ndarray,
        points: np.ndarray,
        labels: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        if not self.is_loaded:
            raise RuntimeError("模型未加载")

        self.predictor.set_image(image)

        masks, scores, _ = self.predictor.predict(
            point_coords=points,
            point_labels=labels,
            multimask_output=True,
        )

        return masks, scores
