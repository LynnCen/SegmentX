"""SAM3 模型管理器"""

from typing import Tuple, Optional
import numpy as np
from .base import BaseModelManager


class SAM3Manager(BaseModelManager):
    """
    SAM3 模型管理器
    使用 sam3 官方库，支持文本提示
    """

    def __init__(self):
        super().__init__()
        self.processor = None

    def load_model(self, checkpoint_path: str = "", device: str = "cpu") -> None:
        try:
            from sam3.model_builder import build_sam3_image_model
            from sam3.model.sam3_image_processor import Sam3Processor
        except ImportError:
            raise ImportError(
                "请安装 SAM3 依赖: pip install git+https://github.com/facebookresearch/sam3.git"
            )

        print("[SAM3] 加载模型...")

        kwargs = {"device": device, "eval_mode": True}
        if checkpoint_path:
            kwargs["checkpoint_path"] = checkpoint_path
            kwargs["load_from_HF"] = False

        model = build_sam3_image_model(**kwargs)
        self.model = model
        self.processor = Sam3Processor(model, confidence_threshold=0.5)
        self.is_loaded = True

        print(f"[SAM3] ✅ 加载完成 (device: {device})")

    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        raise NotImplementedError(
            "SAM3 不支持独立的 Embedding 导出 (Detector 架构无法拆分)"
        )

    def segment(
        self,
        image: np.ndarray,
        points: np.ndarray,
        labels: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """点击分割 (使用 visual prompt)"""
        if not self.is_loaded:
            raise RuntimeError("模型未加载")

        from PIL import Image

        pil_image = Image.fromarray(image)
        state = self.processor.set_image(pil_image)

        # SAM3 visual prompt
        state = self.processor.set_visual_prompt(
            state=state,
            points=points.tolist(),
            labels=[bool(l) for l in labels],
        )

        masks = state["masks"].cpu().numpy()
        scores = state["scores"].cpu().numpy()

        return masks, scores

    def segment_text(
        self,
        image: np.ndarray,
        prompt: str,
        confidence: float = 0.5,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        文本提示分割 (SAM3 独有)
        返回: (masks [N,H,W], scores [N], boxes [N,4])
        """
        if not self.is_loaded:
            raise RuntimeError("模型未加载")

        from PIL import Image

        pil_image = Image.fromarray(image)
        state = self.processor.set_image(pil_image)
        state = self.processor.set_text_prompt(state=state, prompt=prompt)

        masks = state["masks"]
        scores = state["scores"]
        boxes = state["boxes"]

        # 过滤低置信度
        high_conf = scores > confidence
        masks = masks[high_conf].cpu().numpy()
        scores = scores[high_conf].cpu().numpy()
        boxes = boxes[high_conf].cpu().numpy()

        return masks, scores, boxes

    def cleanup(self):
        super().cleanup()
        self.processor = None
