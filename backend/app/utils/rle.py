"""RLE 编解码工具"""

import numpy as np


def encode_mask_rle(mask: np.ndarray) -> str:
    """将二值 mask 编码为 RLE 字符串"""
    pixels = mask.flatten()
    pixels = np.concatenate([[0], pixels, [0]])
    runs = np.where(pixels[1:] != pixels[:-1])[0] + 1
    runs[1::2] -= runs[::2]
    return " ".join(str(x) for x in runs)


def decode_mask_rle(rle: str, shape: tuple[int, int]) -> np.ndarray:
    """将 RLE 字符串解码为二值 mask"""
    runs = np.array([int(x) for x in rle.split()])
    starts = runs[0::2]
    lengths = runs[1::2]

    mask = np.zeros(shape[0] * shape[1], dtype=np.uint8)
    for start, length in zip(starts, lengths):
        mask[start : start + length] = 1

    return mask.reshape(shape)
