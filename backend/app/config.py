"""应用配置"""

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # 应用
    app_name: str = "SegmentX API"
    debug: bool = True

    # 模型
    models_dir: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
    device: str = "mps"  # cuda / cpu / mps (macOS Apple Silicon)

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # 支持的模型注册表
    available_models: dict[str, dict] = {
        # SAM1
        "sam1_vit_b": {
            "checkpoint": "sam_vit_b_01ec64.pth",
            "type": "vit_b",
            "family": "sam1",
        },
        "sam1_vit_l": {
            "checkpoint": "sam_vit_l_0b3195.pth",
            "type": "vit_l",
            "family": "sam1",
        },
        "sam1_vit_h": {
            "checkpoint": "sam_vit_h_4b8939.pth",
            "type": "vit_h",
            "family": "sam1",
        },
        # SAM2
        "sam2_tiny": {
            "checkpoint": "sam2_hiera_tiny.pt",
            "config": "sam2_hiera_t.yaml",
            "family": "sam2",
        },
        "sam2_small": {
            "checkpoint": "sam2_hiera_small.pt",
            "config": "sam2_hiera_s.yaml",
            "family": "sam2",
        },
        # SAM-HQ
        "sam_hq_vit_b": {
            "checkpoint": "sam_hq_vit_b.pth",
            "type": "vit_b",
            "family": "sam_hq",
        },
        "sam_hq_vit_h": {
            "checkpoint": "sam_hq_vit_h.pth",
            "type": "vit_h",
            "family": "sam_hq",
        },
        # SAM3
        "sam3": {
            "checkpoint": "sam3.pt",
            "family": "sam3",
        },
    }

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
