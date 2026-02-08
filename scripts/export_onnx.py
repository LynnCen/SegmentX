"""
将 SAM1 Encoder 导出为 ONNX 格式 (用于纯前端模式)

导出内容:
  sam1_encoder_vit_b.onnx — Image Encoder (量化后 ~95MB)

注: Decoder 已有 (sam_decoder.onnx / sam1_decoder.onnx, 16MB)

使用:
  cd backend && source venv/bin/activate
  python ../scripts/export_onnx.py
"""

import os
import sys
import time
import warnings

warnings.filterwarnings("ignore")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(PROJECT_DIR, "backend")
MODELS_DIR = os.path.join(BACKEND_DIR, "models")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "frontend", "public", "models")

os.makedirs(OUTPUT_DIR, exist_ok=True)


def export_encoder():
    """导出 SAM1 Image Encoder 到 ONNX (使用传统导出器)"""
    import torch
    from segment_anything import sam_model_registry

    checkpoint = os.path.join(MODELS_DIR, "sam_vit_b_01ec64.pth")
    if not os.path.exists(checkpoint):
        print(f"❌ 找不到模型: {checkpoint}")
        sys.exit(1)

    print("=" * 50)
    print("Step 1: 加载 SAM1 ViT-B...")
    print("=" * 50)

    sam = sam_model_registry["vit_b"](checkpoint=checkpoint)
    sam.eval()

    encoder = sam.image_encoder
    encoder.eval()

    # 输入: [1, 3, 1024, 1024]
    dummy = torch.randn(1, 3, 1024, 1024)
    output_path = os.path.join(OUTPUT_DIR, "sam1_encoder_vit_b.onnx")

    print(f"\nStep 2: 导出 Encoder → ONNX (传统导出器)...")
    start = time.time()

    # 关键: dynamo=False 使用传统 ONNX 导出, 兼容 SAM 的动态操作
    torch.onnx.export(
        encoder,
        dummy,
        output_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["input_image"],
        output_names=["image_embeddings"],
        dynamo=False,  # 强制使用传统导出器
    )

    elapsed = time.time() - start
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✅ Encoder 导出完成: {size_mb:.1f} MB ({elapsed:.1f}s)")

    return output_path


def quantize_model(onnx_path: str):
    """int8 动态量化减小体积"""
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        print("⚠️  onnxruntime 未安装, 跳过量化")
        return onnx_path

    print(f"\nStep 3: 量化 Encoder (int8)...")
    quantized = onnx_path.replace(".onnx", "_q.onnx")

    start = time.time()
    quantize_dynamic(
        model_input=onnx_path,
        model_output=quantized,
        weight_type=QuantType.QUInt8,
    )
    elapsed = time.time() - start

    orig = os.path.getsize(onnx_path) / (1024 * 1024)
    quant = os.path.getsize(quantized) / (1024 * 1024)
    print(f"✅ 量化完成: {orig:.0f} MB → {quant:.0f} MB ({quant/orig*100:.0f}%)")

    os.remove(onnx_path)
    os.rename(quantized, onnx_path)
    return onnx_path


def setup_decoder():
    """确保 Decoder 文件存在 (复制/重命名已有文件)"""
    decoder_src = os.path.join(OUTPUT_DIR, "sam_decoder.onnx")
    decoder_dst = os.path.join(OUTPUT_DIR, "sam1_decoder.onnx")

    if os.path.exists(decoder_dst):
        size = os.path.getsize(decoder_dst) / (1024 * 1024)
        print(f"\n✅ Decoder 已存在: sam1_decoder.onnx ({size:.1f} MB)")
        return

    if os.path.exists(decoder_src):
        import shutil
        shutil.copy2(decoder_src, decoder_dst)
        size = os.path.getsize(decoder_dst) / (1024 * 1024)
        print(f"\n✅ 已复制 Decoder: sam1_decoder.onnx ({size:.1f} MB)")
    else:
        print(f"\n⚠️  Decoder 文件不存在: {decoder_src}")
        print("   混合模式的 Decoder 会自动导出，或手动运行:")
        print("   python -c \"from segment_anything.utils.onnx import SamOnnxModel; ...\"")


def main():
    print("🔧 SAM1 ONNX 导出工具")
    print(f"   模型: {MODELS_DIR}")
    print(f"   输出: {OUTPUT_DIR}\n")

    encoder_path = export_encoder()
    quantize_model(encoder_path)
    setup_decoder()

    print("\n" + "=" * 50)
    print("🎉 完成! 文件列表:")
    print("=" * 50)
    for f in sorted(os.listdir(OUTPUT_DIR)):
        if f.endswith(".onnx"):
            s = os.path.getsize(os.path.join(OUTPUT_DIR, f)) / (1024 * 1024)
            print(f"  📦 {f} ({s:.1f} MB)")
    print(f"\n纯前端模式现在可以使用了!")


if __name__ == "__main__":
    main()
