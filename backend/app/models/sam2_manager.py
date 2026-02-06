"""SAM2 模型管理器"""

from typing import Tuple
import numpy as np
from .base import BaseModelManager


class SAM2Manager(BaseModelManager):
    """
    SAM2 模型管理器
    使用 sam2 官方库
    """

    def load_model(self, checkpoint_path: str, config: str = "sam2_hiera_t.yaml", device: str = "cpu") -> None:
        try:
            import torch
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
        except ImportError:
            raise ImportError(
                "请安装 SAM2 依赖: pip install git+https://github.com/facebookresearch/sam2.git"
            )

        print(f"[SAM2] 加载 {config} from {checkpoint_path}...")

        sam2 = build_sam2(config, checkpoint_path, device=device)
        self.model = sam2
        self.predictor = SAM2ImagePredictor(sam2)
        self.is_loaded = True

        print(f"[SAM2] ✅ 加载完成 (device: {device})")

    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        if not self.is_loaded:
            raise RuntimeError("模型未加载")

        import torch

        with torch.no_grad():
            self.predictor.set_image(image)
            # SAM2 的 embedding 获取方式
            embedding = self.predictor._features["image_embed"]
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
