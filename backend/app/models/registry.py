"""全局模型注册表"""

from typing import Optional
import os
from .base import BaseModelManager
from .sam1_manager import SAM1Manager
from .sam2_manager import SAM2Manager
from .sam_hq_manager import SAMHQManager
from .sam3_manager import SAM3Manager
from ..config import settings


class ModelRegistry:
    """
    模型注册表 - 单例模式
    管理所有已加载的模型实例
    """

    def __init__(self):
        self._managers: dict[str, BaseModelManager] = {}

    def load(self, model_id: str) -> BaseModelManager:
        """加载模型并返回管理器"""
        # 已加载则直接返回
        if model_id in self._managers:
            return self._managers[model_id]

        # 查找配置
        model_config = settings.available_models.get(model_id)
        if not model_config:
            raise ValueError(f"未知模型: {model_id}")

        # 创建对应的管理器
        family = model_config["family"]
        checkpoint_path = os.path.join(
            settings.models_dir, model_config["checkpoint"]
        )

        if family == "sam1":
            manager = SAM1Manager()
            manager.load_model(
                checkpoint_path,
                model_type=model_config.get("type", "vit_b"),
                device=settings.device,
            )
        elif family == "sam2":
            manager = SAM2Manager()
            manager.load_model(
                checkpoint_path,
                config=model_config.get("config", "sam2_hiera_t.yaml"),
                device=settings.device,
            )
        elif family == "sam_hq":
            manager = SAMHQManager()
            manager.load_model(
                checkpoint_path,
                model_type=model_config.get("type", "vit_b"),
                device=settings.device,
            )
        elif family == "sam3":
            manager = SAM3Manager()
            manager.load_model(
                checkpoint_path=checkpoint_path,
                device=settings.device,
            )
        else:
            raise ValueError(f"不支持的模型族: {family}")

        manager._model_id = model_id
        self._managers[model_id] = manager
        return manager

    def get(self, model_id: str) -> Optional[BaseModelManager]:
        """获取已加载的模型（不自动加载）"""
        return self._managers.get(model_id)

    def get_or_load(self, model_id: str) -> BaseModelManager:
        """获取模型，未加载则自动加载"""
        manager = self.get(model_id)
        if manager is None:
            manager = self.load(model_id)
        return manager

    def list_loaded(self) -> list[str]:
        """列出已加载的模型 ID"""
        return list(self._managers.keys())

    def unload(self, model_id: str) -> None:
        """卸载模型"""
        if model_id in self._managers:
            self._managers[model_id].cleanup()
            del self._managers[model_id]

    def unload_all(self) -> None:
        """卸载所有模型"""
        for manager in self._managers.values():
            manager.cleanup()
        self._managers.clear()


# 全局单例
model_registry = ModelRegistry()
