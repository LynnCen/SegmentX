#!/bin/bash

echo "=== SegmentX 模型下载 ==="
echo ""

MODELS_DIR="$(dirname "$0")/../backend/models"
mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR"

echo "请选择要下载的模型:"
echo "  1) SAM1 ViT-B  (375MB) - 推荐入门"
echo "  2) SAM2 Small  (46MB)  - 推荐前端"
echo "  3) SAM-HQ ViT-B (379MB) - 高质量"
echo "  4) 全部下载"
echo ""
read -p "选择 (1-4): " choice

case $choice in
  1)
    echo "下载 SAM1 ViT-B..."
    wget -c https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
    ;;
  2)
    echo "下载 SAM2 Small..."
    wget -c https://dl.fbaipublicfiles.com/sam2/072824/sam2_hiera_small.pt
    ;;
  3)
    echo "下载 SAM-HQ ViT-B..."
    wget -c https://huggingface.co/lkeab/hq-sam/resolve/main/sam_hq_vit_b.pth
    ;;
  4)
    echo "下载所有模型..."
    wget -c https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
    wget -c https://dl.fbaipublicfiles.com/sam2/072824/sam2_hiera_small.pt
    wget -c https://huggingface.co/lkeab/hq-sam/resolve/main/sam_hq_vit_b.pth
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac

echo ""
echo "✅ 下载完成！"
ls -lh *.pth *.pt 2>/dev/null
