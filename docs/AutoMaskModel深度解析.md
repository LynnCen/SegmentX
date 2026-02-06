# AutoMaskModel 深度解析：前端主体选择的核心实现

> 从使用到原理，从数据到实现的完整技术剖析  
> 作者：资深前端专家 & 大模型技术讲师

---

## 📚 目录

**第一部分：理解 AutoMaskModel**
- [第一章：AutoMaskModel 是什么](#第一章automaskmodel-是什么)
- [第二章：数据输入与输出](#第二章数据输入与输出)
- [第三章：内部数据结构](#第三章内部数据结构)

**第二部分：初始化流程深度剖析**
- [第四章：构造函数的7个关键步骤](#第四章构造函数的7个关键步骤)
- [第五章：PickCanvas的构建原理](#第五章pickcanvas的构建原理)

**第三部分：核心方法实现**
- [第六章：pickLayer - 点击拾取算法](#第六章picklayer---点击拾取算法)
- [第七章：toggleLayerMode - 智能模式切换](#第七章togglelayermode---智能模式切换)
- [第八章：getMaskResult - 图层合成](#第八章getmaskresult---图层合成)

**第四部分：实战与设计思想**
- [第九章：完整使用示例](#第九章完整使用示例)
- [第十章：设计思想与优化](#第十章设计思想与优化)

---

# 第一部分：理解 AutoMaskModel

## 第一章：AutoMaskModel 是什么

### 1.1 用一句话理解

`AutoMaskModel` 是一个**基于后端预生成的多层mask，通过用户点击进行层选择和组合的前端模型**。

### 1.2 解决什么问题？

想象这样的场景：

```
原图：一张客厅照片
包含：沙发、茶几、花瓶、地毯

用户需求：
1. 点击沙发 → 选中整个沙发
2. 再点击茶几 → 沙发+茶几都选中
3. 再点击沙发上的靠垫 → 从沙发中扣除靠垫
4. 导出最终选区的抠图
```

**传统方案的问题**：
- 需要手动勾勒轮廓（费时费力）
- 或者每次点击都要调用后端API（延迟高）

**AutoMaskModel的方案**：
- 后端**一次性**生成所有可能的分割层（50-100层）
- 前端**实时**响应用户点击，组合不同的层
- **毫秒级**反馈，无需网络请求

### 1.3 核心能力

```typescript
// 1. 点击拾取
model.pickLayer(x, y)  // 返回点击位置对应的层

// 2. 智能切换
model.toggleLayerMode(x, y)  // 智能切换层的选择状态

// 3. 获取结果
model.getMaskResult()  // 合成所有选中的层

// 4. 状态管理
model.getAutoMasks()  // 导出当前所有层的状态
model.setSimpleAutoMasks(masks)  // 恢复层的状态
model.reset()  // 重置所有选择
```

### 1.4 与其他方案的对比

| 特性 | 手动勾勒 | 魔棒工具 | AutoMaskModel |
|-----|---------|---------|--------------|
| 精确度 | 高（但耗时） | 低 | 高 |
| 速度 | 慢 | 快 | 极快 |
| 易用性 | 难 | 简单 | 简单 |
| 网络依赖 | 无 | 无 | 首次加载 |
| 复杂场景 | 支持 | 不支持 | 支持 |

---

## 第二章：数据输入与输出

### 2.1 输入：构造函数参数

```typescript
constructor(
  autoMasks: IAutoMask[],      // 后端返回的多层mask数据
  image: HTMLImageElement       // 原图
)
```

#### 参数1：autoMasks（核心数据）

这是一个**数组**，每个元素代表一层分割结果：

```typescript
interface IAutoMask {
  area: number;                // 该层的像素面积
  segmentation: {              // RLE压缩的mask数据
    counts: number[];          // 游程编码数组
    size: [height, width];     // mask尺寸
  };
  mode?: null | 'source-over' | 'destination-out';  // 可选：初始模式
}
```

**真实数据示例**：
```json
[
  {
    "area": 152340,
    "segmentation": {
      "counts": [0, 8, 15, 4, 23, 7, ...],
      "size": [1024, 768]
    }
  },
  {
    "area": 89320,
    "segmentation": {
      "counts": [120, 5, 89, 12, ...],
      "size": [1024, 768]
    }
  },
  // ... 通常有 50-100 层
]
```

**数据来源**：
```typescript
// 通过 SamFactory 获取
const factory = SamFactory.getInstance({...});
const model = await factory.createAutoMaskModel(imageUrl);
// 内部会调用 ApiService.autoMasks(imageUrl) 获取这些数据
```

#### 参数2：image（原图对象）

```typescript
const image = new Image();
image.src = 'https://example.com/photo.jpg';
await image.decode();  // 等待图片加载完成

const model = new AutoMaskModel(autoMasks, image);
```

**为什么需要原图？**
- 用于坐标转换（屏幕坐标 → Canvas坐标）
- 最终合成时需要原图尺寸
- 导出抠图时需要叠加原图

### 2.2 输出：方法返回值

#### 主要输出：AutoMaskResult

```typescript
const result: AutoMaskResult | null = model.toggleLayerMode(x, y);

if (result) {
  // 1. 获取黑白mask
  const maskCanvas: HTMLCanvasElement = result.getMask();
  
  // 2. 获取抠图（带原图内容）
  const imageCanvas: HTMLCanvasElement = result.getImage();
  
  // 3. 后端精修（可选）
  await result.matting();
  const refinedMask = result.getMask();
}
```

#### 辅助输出：层信息

```typescript
// 完整层信息（包含RLE数据）
const fullMasks: IAutoMask[] = model.getAutoMasks();

// 简化层信息（只有ID和模式）
const simpleMasks: {id: string, mode: ...}[] = model.getSimpleAutoMasks();
```

**用途**：
- 保存用户的选择状态
- 实现撤销/重做功能
- 跨页面传递选择结果

---

## 第三章：内部数据结构

### 3.1 类的成员变量

```typescript
export class AutoMaskModel {
  private autoMaskLayers: AutoMaskLayer[];     // 所有层的数组
  private pickCanvas: HTMLCanvasElement;       // 颜色拾取画布
  private layerMap: Map<string, AutoMaskLayer>; // ID → 层的映射
  private image: HTMLImageElement;             // 原图引用
}
```

让我逐一解释每个成员变量的作用。

### 3.2 autoMaskLayers：层数组

这是**核心数据结构**，存储所有的分割层。

```typescript
type AutoMaskLayer = {
  id: string;                    // 唯一标识（'1', '2', '3', ...）
  color: [R, G, B, A];           // 颜色ID（用于拾取）
  mode: null | 'source-over' | 'destination-out';  // 当前模式
  area: number;                  // 面积（像素数）
  maskCanvas: HTMLCanvasElement; // 该层的mask画布
  segmentation: {                // 原始RLE数据（用于导出）
    counts: number[];
    size: [height, width];
  };
}
```

**示例数据**：
```typescript
autoMaskLayers = [
  {
    id: '1',
    color: [0, 0, 1, 255],
    mode: null,              // 未选中
    area: 152340,
    maskCanvas: <canvas>,    // 1024×768的Canvas
    segmentation: {...}
  },
  {
    id: '2',
    color: [0, 0, 2, 255],
    mode: 'source-over',     // 已选中（正选）
    area: 89320,
    maskCanvas: <canvas>,
    segmentation: {...}
  },
  // ... 更多层
]
```

**排序规则**：按面积**从大到小**排序
```
layers[0]  // 最大的层（通常是整个主体）
layers[1]  // 次大的层
...
layers[n]  // 最小的层（细节部分）
```

### 3.3 pickCanvas：拾取画布

这是一个**隐藏的Canvas**，用户看不到，专门用于快速定位用户点击的层。

**原理**：每层用唯一的颜色绘制，点击时读取颜色即可定位层。

```
pickCanvas 的样子（假想图）：
┌──────────────┐
│  颜色1区域    │  ← 第1层用rgb(0,0,1)绘制
│  ┌────────┐  │
│  │颜色2区 │  │  ← 第2层用rgb(0,0,2)绘制
│  │  ┌──┐  │  │
│  │  │颜3│  │  │  ← 第3层用rgb(0,0,3)绘制
│  │  └──┘  │  │
│  └────────┘  │
└──────────────┘

用户点击 → 读取颜色 → 找到对应层（O(1)时间）
```

**尺寸**：与mask相同（通常是原图尺寸）
```typescript
this.pickCanvas.width = autoMasks[0].segmentation.size[1];   // 宽度
this.pickCanvas.height = autoMasks[0].segmentation.size[0];  // 高度
```

### 3.4 layerMap：快速查找表

```typescript
layerMap = new Map<string, AutoMaskLayer>();
// '1' → layer1
// '2' → layer2
// ...
```

**作用**：通过ID快速找到层对象

**使用场景**：
```typescript
// 恢复用户之前的选择
const savedMasks = [{id: '5', mode: 'source-over'}, ...];

savedMasks.forEach(mask => {
  const layer = this.layerMap.get(mask.id);  // O(1) 查找
  if (layer) {
    layer.mode = mask.mode;
  }
});
```

---

# 第二部分：初始化流程深度剖析

## 第四章：构造函数的7个关键步骤

让我们逐行剖析构造函数，看看初始化过程中发生了什么。

```typescript
constructor(autoMasks: IAutoMask[], private image: HTMLImageElement) {
  // 步骤1：获取颜色ID服务实例
  const colorIdService = ColorIdService.getInstance();
  
  // 步骤2：创建pickCanvas
  this.pickCanvas = document.createElement('canvas');
  this.pickCanvas.width = autoMasks[0].segmentation.size[1];
  this.pickCanvas.height = autoMasks[0].segmentation.size[0];
  const ctx = this.pickCanvas.getContext('2d')!;
  
  // 步骤3-7：处理每一层
  this.autoMaskLayers = autoMasks
    .sort((a, b) => b.area - a.area)  // 步骤3：按面积排序
    .map<AutoMaskLayer>((autoMask) => {
      // 步骤4：生成颜色ID
      const [id, color] = colorIdService.generateID();
      
      // 步骤5：解码RLE为Canvas
      const mask = rleToMask(
        autoMask.segmentation.counts,
        autoMask.segmentation.size[1],
        autoMask.segmentation.size[0],
        color,  // 使用颜色ID绘制
      );
      
      // 步骤6：绘制到pickCanvas
      ctx.drawImage(mask, 0, 0);
      
      // 步骤7：构建层对象
      const layer = {
        maskCanvas: mask,
        id,
        color,
        mode: autoMask.mode ?? null,
        segmentation: autoMask.segmentation,
        area: autoMask.area,
      };
      
      this.layerMap.set(id, layer);
      return layer;
    });
}
```

### 4.1 步骤1：获取颜色ID服务

```typescript
const colorIdService = ColorIdService.getInstance();
```

**ColorIdService** 是一个单例服务，负责生成唯一的颜色ID。

**为什么用单例？**
- 确保全局的ID唯一性
- 避免颜色冲突

**工作原理**：
```typescript
class ColorIdService {
  private currentId = 0;
  
  generateID() {
    this.currentId++;
    const r = (this.currentId >>> 16) & 0xFF;
    const g = (this.currentId >>> 8) & 0xFF;
    const b = this.currentId & 0xFF;
    return [this.currentId.toString(), [r, g, b, 255]];
  }
}
```

**生成的ID序列**：
```
ID=1  → color=[0, 0, 1, 255]
ID=2  → color=[0, 0, 2, 255]
...
ID=256 → color=[0, 1, 0, 255]
```

### 4.2 步骤2：创建pickCanvas

```typescript
this.pickCanvas = document.createElement('canvas');
this.pickCanvas.width = autoMasks[0].segmentation.size[1];
this.pickCanvas.height = autoMasks[0].segmentation.size[0];
```

**关键点1**：为什么用 `autoMasks[0]` 的尺寸？

因为所有层的尺寸**都相同**（都是原图的分割结果），所以取第一层的尺寸即可。

**关键点2**：为什么 `width` 用 `size[1]`，`height` 用 `size[0]`？

因为SAM返回的 `size` 格式是 `[height, width]`（注意顺序！）

```typescript
// SAM的格式
size: [1024, 768]  // 高度=1024, 宽度=768

// Canvas的设置
canvas.width = size[1];   // 768
canvas.height = size[0];  // 1024
```

### 4.3 步骤3：按面积排序

```typescript
.sort((a, b) => b.area - a.area)
```

**为什么要排序？**

这是**极其关键**的一步！让我用例子说明：

**场景**：一只猫坐在沙发上
- 大层：整只猫（area=10000）
- 小层：猫耳朵（area=500）

**如果不排序（或者小层在前）**：
```
pickCanvas绘制顺序：
1. 先画猫耳朵（用颜色2）
2. 后画整只猫（用颜色1）

结果：猫耳朵被覆盖了！
用户点击耳朵时，读到的是颜色1（整只猫）
```

**正确排序（大层在前）**：
```
pickCanvas绘制顺序：
1. 先画整只猫（用颜色1）
2. 后画猫耳朵（用颜色2）

结果：猫耳朵覆盖在上面
用户点击耳朵时，读到的是颜色2（耳朵）✓
```

**排序规则**：
```typescript
// b.area - a.area  → 降序（从大到小）
[
  {area: 10000, ...},  // 最大
  {area: 5000, ...},
  {area: 1000, ...},
  {area: 500, ...}     // 最小
]
```

### 4.4 步骤4：生成颜色ID

```typescript
const [id, color] = colorIdService.generateID();
// id: '1', '2', '3', ...
// color: [0, 0, 1, 255], [0, 0, 2, 255], ...
```

**每层获得唯一标识**：
- `id`：用于映射和查找
- `color`：用于pickCanvas绘制

### 4.5 步骤5：解码RLE为Canvas

```typescript
const mask = rleToMask(
  autoMask.segmentation.counts,   // RLE编码数组
  autoMask.segmentation.size[1],  // 宽度
  autoMask.segmentation.size[0],  // 高度
  color,                          // 使用颜色ID
);
```

**输入**：
```typescript
counts: [0, 8, 15, 4, ...]
size: [1024, 768]
color: [0, 0, 1, 255]
```

**输出**：
```
一个 768×1024 的Canvas
白色区域用指定的color填充
```

**关键**：这里传入的 `color` 参数，使得每层用不同的颜色绘制！

**rleToMask 内部逻辑**（简化版）：
```typescript
function rleToMask(counts, width, height, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  // 解码RLE
  let pos = 0;
  for (let i = 0; i < counts.length; i += 2) {
    pos += counts[i];  // 跳过黑色
    for (let j = 0; j < counts[i + 1]; j++) {
      imageData.data[pos * 4] = color[0];      // 用指定颜色填充
      imageData.data[pos * 4 + 1] = color[1];
      imageData.data[pos * 4 + 2] = color[2];
      imageData.data[pos * 4 + 3] = color[3];
      pos++;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
```

### 4.6 步骤6：绘制到pickCanvas

```typescript
ctx.drawImage(mask, 0, 0);
```

**这一步的作用**：将当前层（用颜色ID绘制）叠加到pickCanvas上。

**累积效果**：
```
第1层绘制后：pickCanvas上有颜色1的区域
第2层绘制后：pickCanvas上有颜色1和颜色2的区域
第3层绘制后：pickCanvas上有颜色1、2、3的区域
...
最后：pickCanvas上有所有层的颜色信息
```

**后绘制的层会覆盖先绘制的层**（这就是为什么要按面积排序）。

### 4.7 步骤7：构建层对象

```typescript
const layer = {
  maskCanvas: mask,      // 保存这一层的Canvas（用于后续合成）
  id,                    // 唯一标识
  color,                 // 颜色ID
  mode: autoMask.mode ?? null,  // 初始模式（通常是null）
  segmentation: autoMask.segmentation,  // 原始RLE（用于导出）
  area: autoMask.area,   // 面积（用于判断包含关系）
};

this.layerMap.set(id, layer);  // 添加到映射表
return layer;  // 返回层对象，添加到数组
```

**最终数据结构**：
```typescript
this.autoMaskLayers = [
  {
    id: '1',
    color: [0, 0, 1, 255],
    mode: null,
    area: 152340,
    maskCanvas: <canvas1>,  // 用颜色[0,0,1,255]绘制的mask
    segmentation: {...}
  },
  {
    id: '2',
    color: [0, 0, 2, 255],
    mode: null,
    area: 89320,
    maskCanvas: <canvas2>,  // 用颜色[0,0,2,255]绘制的mask
    segmentation: {...}
  },
  // ...
];

this.layerMap = {
  '1' => layer1,
  '2' => layer2,
  ...
};
```

---

## 第五章：PickCanvas的构建原理

### 5.1 PickCanvas的最终状态

初始化完成后，pickCanvas上的内容是什么样的？

```
假设有3层：
- 第1层：整只猫（最大，用rgb(0,0,1)）
- 第2层：猫身体（中等，用rgb(0,0,2)）
- 第3层：猫耳朵（最小，用rgb(0,0,3)）

pickCanvas的像素分布：
┌────────────────┐
│  □□□□□□□□□□  │  ← 背景（黑色或透明）
│  □1111111□□□  │  ← 猫的轮廓（颜色1）
│  □1222221□□□  │  ← 猫身体覆盖了轮廓（颜色2）
│  □1233321□□□  │  ← 猫耳朵覆盖了身体（颜色3）
│  □1222221□□□  │
│  □1111111□□□  │
│  □□□□□□□□□□  │
└────────────────┘

数字1=rgb(0,0,1)
数字2=rgb(0,0,2)
数字3=rgb(0,0,3)
```

### 5.2 点击拾取的工作原理

当用户点击坐标 `(x, y)` 时：

```typescript
// 1. 读取pickCanvas上该位置的颜色
const pixel = pickCanvasCtx.getImageData(x, y, 1, 1);
const color = [pixel.data[0], pixel.data[1], pixel.data[2], pixel.data[3]];

// 2. 找到颜色最接近的层
for (let layer of layers) {
  const distance = colorDistance(layer.color, color);
  if (distance < 3) {
    return layer;  // 找到了！
  }
}
```

**时间复杂度**：
- **读取颜色**：O(1)
- **匹配层**：O(n)，但n通常很小（<100）
- **总体**：O(1) 级别，极快！

**对比其他方案**：
```typescript
// ❌ 方案1：逐层判断像素
for (let layer of layers) {
  const pixel = layer.maskCanvas.getImageData(x, y, 1, 1);
  if (pixel.data[3] > 0) return layer;
}
// 问题：需要读取n次ImageData，很慢

// ✅ 方案2：PickCanvas（当前方案）
const pixel = pickCanvas.getImageData(x, y, 1, 1);
return findLayerByColor(pixel);
// 优势：只读取1次ImageData，极快
```

### 5.3 为什么需要颜色距离匹配？

理论上，颜色应该完全匹配：
```
layer.color = [0, 0, 1, 255]
pixel.color = [0, 0, 1, 255]
完全相等 ✓
```

但实际中可能出现微小差异：
```
layer.color = [0, 0, 1, 255]
pixel.color = [0, 0, 2, 255]  // 差了1！
```

**原因**：
1. **Canvas的抗锯齿**：边缘像素会混合
2. **浮点数精度**：颜色计算时的精度损失
3. **浏览器差异**：不同浏览器的渲染引擎

**解决方案**：使用欧式距离，允许小误差
```typescript
function colorDistance(c1, c2) {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr*dr + dg*dg + db*db);
}

// 阈值设为3，允许RGB每个通道±1的误差
if (distance < 3) {
  // 认为是匹配的
}
```

---

# 第三部分：核心方法实现

## 第六章：pickLayer - 点击拾取算法

### 6.1 方法签名

```typescript
pickLayer(x: number, y: number): AutoMaskLayer | null
```

**作用**：根据点击坐标，找到对应的层（但**不改变**任何状态）。

**返回值**：
- 找到了 → 返回 `AutoMaskLayer` 对象
- 没找到 → 返回 `null`

### 6.2 完整实现剖析

```typescript
pickLayer(x: number, y: number): AutoMaskLayer | null {
  // === 步骤1：坐标转换 ===
  const { x: _x, y: _y } = this.getCoordinate(x, y);
  
  // === 步骤2：读取pickCanvas上的颜色 ===
  const ctx = this.pickCanvas.getContext('2d')!;
  const imageData = ctx?.getImageData(_x, _y, 1, 1);
  
  // === 步骤3：找到最接近的层 ===
  let minDistance = Number.POSITIVE_INFINITY;
  let layer: AutoMaskLayer | null = null;
  const colorIdService = ColorIdService.getInstance();
  
  this.autoMaskLayers?.forEach((maskLayer) => {
    const distance = colorIdService.checkColorDistance(
      maskLayer.color,
      imageData.data
    );
    
    if (distance < 3 && distance < minDistance) {
      minDistance = distance;
      layer = maskLayer;
    }
  });
  
  return layer;
}
```

### 6.3 步骤1：坐标转换

```typescript
private getCoordinate(x: number, y: number) {
  const scale = this.pickCanvas.width / this.image.naturalWidth;
  const _x = x * scale;
  const _y = y * scale;
  return { x: _x, y: _y };
}
```

**为什么需要转换？**

用户传入的坐标 `(x, y)` 是相对于**原图**的，但pickCanvas的尺寸可能与原图不同。

**示例**：
```
原图：1920×1080
pickCanvas：1024×576（为了节省内存，缩小了）

用户点击原图坐标：(960, 540)  // 原图中心点
需要转换为pickCanvas坐标：
  scale = 1024 / 1920 = 0.533
  _x = 960 * 0.533 = 512
  _y = 540 * 0.533 = 288
```

**注意**：
- 如果 `pickCanvas.width === image.naturalWidth`，scale=1，坐标不变
- 通常情况下，pickCanvas就是原图尺寸，所以这个转换实际上没有缩放

### 6.4 步骤2：读取颜色

```typescript
const ctx = this.pickCanvas.getContext('2d')!;
const imageData = ctx.getImageData(_x, _y, 1, 1);
```

**getImageData参数**：
- `_x, _y`：起始坐标
- `1, 1`：读取1×1像素（只读一个点）

**返回值**：
```typescript
imageData = {
  data: Uint8ClampedArray[R, G, B, A],  // 长度为4
  width: 1,
  height: 1
}

// 例如
imageData.data = [0, 0, 3, 255]  // rgb(0, 0, 3)
```

### 6.5 步骤3：颜色匹配

```typescript
let minDistance = Number.POSITIVE_INFINITY;
let layer: AutoMaskLayer | null = null;

this.autoMaskLayers.forEach((maskLayer) => {
  const distance = colorIdService.checkColorDistance(
    maskLayer.color,        // [0, 0, 1, 255]
    imageData.data          // [0, 0, 3, 255]
  );
  
  if (distance < 3 && distance < minDistance) {
    minDistance = distance;
    layer = maskLayer;
  }
});
```

**算法逻辑**：
1. 遍历所有层
2. 计算每层颜色与点击点颜色的距离
3. 找到距离**最小**且**小于阈值3**的层

**为什么要找最小距离？**

可能有多个层的颜色都很接近（虽然概率极低），选择最接近的保证准确性。

**checkColorDistance实现**：
```typescript
checkColorDistance(color1: [R,G,B,A], color2: Uint8ClampedArray): number {
  const dr = color1[0] - color2[0];
  const dg = color1[1] - color2[1];
  const db = color1[2] - color2[2];
  const da = color1[3] - color2[3];
  
  return Math.sqrt(dr*dr + dg*dg + db*db + da*da);
}
```

**示例计算**：
```
layer.color = [0, 0, 1, 255]
pixel.color = [0, 0, 1, 255]
distance = sqrt(0 + 0 + 0 + 0) = 0 ✓ 完美匹配

layer.color = [0, 0, 1, 255]
pixel.color = [0, 0, 2, 255]
distance = sqrt(0 + 0 + 1 + 0) = 1 ✓ 仍然匹配（<3）

layer.color = [0, 0, 1, 255]
pixel.color = [0, 0, 10, 255]
distance = sqrt(0 + 0 + 81 + 0) = 9 ✗ 不匹配（>3）
```

---

## 第七章：toggleLayerMode - 智能模式切换

### 7.1 方法签名

```typescript
toggleLayerMode(x: number, y: number): AutoMaskResult | null
```

**作用**：点击位置，智能切换该层的模式，并返回合成结果。

**这是整个类最核心、最复杂的方法！**

### 7.2 三种模式

```typescript
mode: null | 'source-over' | 'destination-out'
```

| 模式 | 含义 | Canvas操作 | 视觉效果 |
|-----|------|-----------|---------|
| `null` | 未选中 | 不绘制 | 不参与合成 |
| `'source-over'` | 正选 | 叠加 | 添加到选区 |
| `'destination-out'` | 负选 | 擦除 | 从选区扣除 |

### 7.3 智能切换逻辑

**核心思想**：根据点击位置是否有其他已选中的层，决定切换策略。

**两种情况**：

#### 情况1：独立区域（没有重叠）

```
场景：点击位置只有当前层，没有其他已选中的层

切换规则：
  null → 'source-over' → null → 'source-over' ...
  (未选中 → 选中 → 未选中 → ...)
```

#### 情况2：重叠区域（有其他已选中的层）

```
场景：点击位置有其他已选中的层

判断：当前层与其他层的包含关系
  - 如果其他层更大 → 当前层在其他层内部
  - 如果其他层更小 → 当前层包含其他层

切换规则（在大层内部）：
  null → 'destination-out' → null → 'destination-out' ...
  (未选中 → 扣除 → 未选中 → ...)
```

### 7.4 完整实现剖析

```typescript
toggleLayerMode(x: number, y: number) {
  // === 步骤1：坐标转换 ===
  const { x: _x, y: _y } = this.getCoordinate(x, y);
  
  // === 步骤2：找到点击的层 ===
  const layer = this.pickLayer(x, y);
  if (!layer) return null;  // 没点到任何层
  
  // === 步骤3：查找该位置其他已选中的层 ===
  const selectedLayers = this.autoMaskLayers.filter((maskLayer) => {
    // 排除当前层和未选中的层
    if (maskLayer.mode !== null && layer !== maskLayer) {
      const canvas = maskLayer.maskCanvas;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(_x, _y, 1, 1);
      const data = imageData.data;
      return data[3] > 0;  // 该层在这个位置有像素
    }
    return false;
  });
  
  // === 步骤4：智能决策 ===
  let mode = layer.mode;
  
  if (selectedLayers.length > 0) {
    // 情况2：有重叠
    selectedLayers.forEach((maskLayer) => {
      if (maskLayer.area > layer.area) {
        // 其他层更大 → 当前层在其他层内部
        if (maskLayer.mode === 'source-over') {
          // 其他层是正选态
          if (layer.mode === null || layer.mode === 'source-over') {
            mode = 'destination-out';  // 切换为负选
          } else if (layer.mode === 'destination-out') {
            mode = null;  // 取消负选
          }
        } else {
          // 其他层是负选态
          if (layer.mode === 'source-over') {
            mode = null;
          } else {
            mode = 'source-over';
          }
        }
      }
    });
  } else {
    // 情况1：无重叠
    mode = layer.mode === 'source-over' ? null : 'source-over';
  }
  
  // === 步骤5：更新模式并返回结果 ===
  layer.mode = mode;
  return this.getMaskResult();
}
```

### 7.5 步骤3详解：查找重叠层

```typescript
const selectedLayers = this.autoMaskLayers.filter((maskLayer) => {
  if (maskLayer.mode !== null && layer !== maskLayer) {
    const canvas = maskLayer.maskCanvas;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(_x, _y, 1, 1);
    const data = imageData.data;
    return data[3] > 0;  // alpha > 0 表示有像素
  }
  return false;
});
```

**逻辑**：
1. 遍历所有层
2. 排除当前层自己
3. 排除未选中的层（`mode === null`）
4. 检查该层在点击位置是否有像素（`alpha > 0`）

**为什么检查alpha通道？**

```
maskLayer.maskCanvas 是该层的mask：
- 白色区域（alpha=255）：有前景
- 黑色区域（alpha=0）：无前景

如果 imageData.data[3] > 0，说明点击位置在该层的前景区域内
```

**结果**：
```typescript
selectedLayers = [layer2, layer5]  // 点击位置有这两层
```

### 7.6 步骤4详解：智能决策

让我用具体例子说明决策逻辑。

#### 例子1：选中独立区域

```
场景：
- 点击猫的尾巴
- 尾巴层未选中（mode=null）
- 该位置没有其他已选中的层

执行：
  selectedLayers.length = 0
  进入 else 分支
  mode = null → 'source-over'

结果：尾巴被选中 ✓
```

#### 例子2：在大层内部扣除

```
场景：
- 整只猫已选中（layer1, area=10000, mode='source-over'）
- 点击猫的眼睛想扣除
- 眼睛层未选中（layer2, area=200, mode=null）

执行：
  selectedLayers = [layer1]  // 猫层
  layer1.area (10000) > layer2.area (200) ✓
  layer1.mode === 'source-over' ✓
  layer2.mode === null ✓
  
  → mode = 'destination-out'

结果：眼睛变为扣除模式 ✓
```

#### 例子3：取消扣除

```
场景：
- 整只猫已选中（layer1, mode='source-over'）
- 眼睛已扣除（layer2, mode='destination-out'）
- 再次点击眼睛

执行：
  selectedLayers = [layer1]
  layer1.area > layer2.area ✓
  layer1.mode === 'source-over' ✓
  layer2.mode === 'destination-out' ✓
  
  → mode = null

结果：取消扣除，眼睛回到未选中状态 ✓
```

#### 例子4：复杂组合

```
场景：
- 猫身体已选中（layer1, area=8000, mode='source-over'）
- 猫头已扣除（layer2, area=2000, mode='destination-out'）
- 点击猫耳朵想添加回来（layer3, area=500）
- 耳朵在头部区域内

执行：
  selectedLayers = [layer1, layer2]
  
  检查layer1:
    layer1.area (8000) > layer3.area (500) ✓
    layer1.mode === 'source-over' ✓
    → mode = 'destination-out'
  
  检查layer2:
    layer2.area (2000) > layer3.area (500) ✓
    layer2.mode === 'destination-out'（不是source-over）
    → 按普通规则：mode = 'source-over'

结果：耳朵被添加（正选）✓
```

### 7.7 决策流程图

```
点击某层
  ↓
查找该位置其他已选中的层
  ↓
有重叠？
├─ 否 → 简单切换：null ↔ 'source-over'
└─ 是 → 判断包含关系
        ↓
      其他层更大？
      ├─ 是 → 在大层内部
      │       ↓
      │     大层是正选？
      │     ├─ 是 → null ↔ 'destination-out'
      │     └─ 否 → null ↔ 'source-over'
      └─ 否 → 当前层更大
              ↓
            按普通规则切换
```

---

## 第八章：getMaskResult - 图层合成

### 8.1 方法签名

```typescript
getMaskResult(): AutoMaskResult | null
```

**作用**：合成所有选中的层，返回最终结果。

**返回值**：
- 有选中的层 → 返回 `AutoMaskResult`
- 没有选中的层 → 返回 `null`

### 8.2 实现剖析

```typescript
getMaskResult(): AutoMaskResult | null {
  // 检查是否有选中的层
  if (!this.autoMaskLayers.some((layer) => layer.mode !== null)) {
    return null;
  }
  
  // 创建结果对象，传入所有层
  return new AutoMaskResult(this.image, this.autoMaskLayers);
}
```

**为什么传入所有层？**

`AutoMaskResult` 会自动过滤，只处理 `mode !== null` 的层。

### 8.3 AutoMaskResult的合成逻辑

```typescript
class AutoMaskResult extends BaseMaskResult {
  constructor(image: HTMLImageElement, layers: AutoMaskLayer[]) {
    super(image);
    
    const canvas = this.maskCanvas;  // 来自父类，原图尺寸
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // 逐层绘制
    layers.forEach((maskLayer) => {
      if (maskLayer.mode !== null) {
        // 设置混合模式
        ctx.globalCompositeOperation = maskLayer.mode;
        
        // 绘制该层
        ctx.drawImage(
          maskLayer.maskCanvas,
          0, 0, maskLayer.maskCanvas.width, maskLayer.maskCanvas.height,
          0, 0, canvas.width, canvas.height
        );
      }
    });
    
    ctx.restore();
  }
}
```

### 8.4 合成示例

**场景**：选中了3层
```typescript
layers = [
  {mode: 'source-over', ...},      // 猫身体
  {mode: 'source-over', ...},      // 猫尾巴
  {mode: 'destination-out', ...}   // 猫眼睛（扣除）
];
```

**合成过程**：
```
初始状态：空白Canvas
  ↓
绘制第1层（source-over）：
  ┌────────────┐
  │            │
  │   ■■■■    │  猫身体
  │   ■■■■    │
  │            │
  └────────────┘
  ↓
绘制第2层（source-over）：
  ┌────────────┐
  │     ■      │
  │   ■■■■    │  猫身体+尾巴
  │   ■■■■■  │
  │            │
  └────────────┘
  ↓
绘制第3层（destination-out）：
  ┌────────────┐
  │     ■      │
  │   ■□■■    │  扣除眼睛
  │   ■■■■■  │  （□表示被擦除）
  │            │
  └────────────┘
  ↓
最终结果：猫身体+尾巴-眼睛
```

### 8.5 混合模式的数学原理

#### source-over（叠加）

```
公式：
  result_alpha = src_alpha + dst_alpha * (1 - src_alpha)
  result_color = (src_color * src_alpha + dst_color * dst_alpha * (1 - src_alpha)) / result_alpha
```

**示例**：
```
目标（已有）：RGBA(100, 100, 100, 0.5)
源（新绘制）：RGBA(255, 255, 255, 0.8)

result_alpha = 0.8 + 0.5 * 0.2 = 0.9
result_R = (255*0.8 + 100*0.5*0.2) / 0.9 ≈ 237

结果：RGBA(237, 237, 237, 0.9)
```

#### destination-out（擦除）

```
公式：
  result_alpha = dst_alpha * (1 - src_alpha)
  result_color = dst_color
```

**示例**：
```
目标（已有）：RGBA(100, 100, 100, 1.0)
源（擦除）：  RGBA(任意, 任意, 任意, 1.0)

result_alpha = 1.0 * (1 - 1.0) = 0

结果：完全透明（被擦除）
```

---

# 第四部分：实战与设计思想

## 第九章：完整使用示例

### 9.1 基础使用

```typescript
import { SamFactory, AutoMaskModel } from '@lego/sam';

// 1. 初始化工厂
const factory = SamFactory.getInstance({
  axiosInstance: axios.create({...}),
  upload: async (blob) => {...},
  loadImage: (url) => {...}
});

// 2. 创建模型
const model: AutoMaskModel = await factory.createAutoMaskModel(imageUrl);

// 3. 监听用户点击
canvas.addEventListener('click', (e) => {
  const [x, y] = getImageCoordinates(e, canvas, model.getSourceImage());
  
  const result = model.toggleLayerMode(x, y);
  
  if (result) {
    // 显示选区
    displayMask(result.getMask());
  }
});

// 4. 导出结果
exportBtn.addEventListener('click', () => {
  const result = model.getMaskResult();
  if (result) {
    const imageCanvas = result.getImage();
    downloadCanvas(imageCanvas, 'cutout.png');
  }
});
```

### 9.2 进阶：预览模式

```typescript
class MaskEditor {
  private model: AutoMaskModel;
  private previewLayer: AutoMaskLayer | null = null;
  
  // 鼠标移动：预览
  onMouseMove(x: number, y: number) {
    const layer = this.model.pickLayer(x, y);
    
    if (layer !== this.previewLayer) {
      this.previewLayer = layer;
      
      if (layer) {
        // 显示预览效果
        this.showPreview(layer);
      } else {
        this.hidePreview();
      }
    }
  }
  
  // 点击：确认选择
  onClick(x: number, y: number) {
    const result = this.model.toggleLayerMode(x, y);
    if (result) {
      this.updateDisplay(result);
    }
  }
  
  private showPreview(layer: AutoMaskLayer) {
    // 用半透明绿色显示预览
    const previewCanvas = document.createElement('canvas');
    const ctx = previewCanvas.getContext('2d')!;
    
    ctx.drawImage(layer.maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    this.displayOverlay(previewCanvas);
  }
}
```

### 9.3 进阶：撤销/重做

```typescript
class UndoableEditor {
  private model: AutoMaskModel;
  private history: Array<{id: string, mode: ...}[]> = [];
  private historyIndex = -1;
  
  // 执行操作
  toggleLayer(x: number, y: number) {
    const result = this.model.toggleLayerMode(x, y);
    
    if (result) {
      // 保存状态
      this.saveState();
      this.updateDisplay(result);
    }
  }
  
  // 保存状态
  private saveState() {
    // 删除当前位置之后的历史
    this.history.splice(this.historyIndex + 1);
    
    // 添加新状态
    const state = this.model.getSimpleAutoMasks();
    this.history.push(state);
    this.historyIndex++;
    
    // 限制历史大小
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }
  
  // 撤销
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.model.setSimpleAutoMasks(state);
      this.updateDisplay(this.model.getMaskResult());
    }
  }
  
  // 重做
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.model.setSimpleAutoMasks(state);
      this.updateDisplay(this.model.getMaskResult());
    }
  }
}
```

### 9.4 进阶：状态持久化

```typescript
class PersistentEditor {
  private model: AutoMaskModel;
  
  // 保存到localStorage
  saveToStorage(key: string) {
    const state = {
      imageUrl: this.imageUrl,
      masks: this.model.getSimpleAutoMasks()
    };
    
    localStorage.setItem(key, JSON.stringify(state));
  }
  
  // 从localStorage恢复
  async loadFromStorage(key: string) {
    const json = localStorage.getItem(key);
    if (!json) return false;
    
    const state = JSON.parse(json);
    
    // 重新加载图片和模型
    this.model = await factory.createAutoMaskModel(state.imageUrl);
    
    // 恢复选择状态
    this.model.setSimpleAutoMasks(state.masks);
    
    // 显示结果
    const result = this.model.getMaskResult();
    if (result) {
      this.updateDisplay(result);
    }
    
    return true;
  }
}
```

---

## 第十章：设计思想与优化

### 10.1 设计思想

#### 1. 分离关注点

```
数据层（AutoMaskModel）：
  - 管理层数据
  - 处理用户交互逻辑
  - 不涉及UI渲染

渲染层（你的代码）：
  - 显示Canvas
  - 处理鼠标事件
  - 调用AutoMaskModel的方法

好处：
  - 易于测试
  - 易于维护
  - 易于复用
```

#### 2. 单一职责

```typescript
class AutoMaskModel {
  // ✓ 负责：层管理、点击拾取、模式切换
  // ✗ 不负责：网络请求、UI渲染、事件监听
}

class SamFactory {
  // ✓ 负责：创建模型、管理依赖
  // ✗ 不负责：业务逻辑
}

class ApiService {
  // ✓ 负责：网络请求
  // ✗ 不负责：数据处理
}
```

#### 3. 不可变性

```typescript
// ✓ 方法不改变外部状态
pickLayer(x, y)  // 只读取，不修改

// ✓ 模式切换返回新结果
toggleLayerMode(x, y)  // 修改内部状态，返回新结果

// ✓ 状态导出/恢复
getSimpleAutoMasks()  // 导出快照
setSimpleAutoMasks(masks)  // 恢复快照
```

### 10.2 性能优化

#### 优化1：颜色ID拾取（O(1)查找）

```typescript
// ❌ 朴素方案（O(n)）
for (let layer of layers) {
  if (layer.containsPoint(x, y)) {
    return layer;
  }
}

// ✅ 颜色ID方案（O(1)）
const color = pickCanvas.getImageData(x, y, 1, 1);
return layerMap.get(colorToId(color));
```

**性能对比**：
```
100层，1000次点击：
  朴素方案：100×1000 = 100,000次判断
  颜色ID方案：1000次读取 + 1000次查找 ≈ 2,000次操作
  
  加速比：50倍！
```

#### 优化2：按需合成

```typescript
// ✓ 只在需要时合成
toggleLayerMode(x, y) {
  layer.mode = newMode;
  return this.getMaskResult();  // 立即合成并返回
}

// ✗ 不是每次改变都合成
setSimpleAutoMasks(masks) {
  // 批量设置
  masks.forEach(m => {
    layer.mode = m.mode;  // 只修改，不合成
  });
  // 外部调用 getMaskResult() 时才合成
}
```

#### 优化3：Canvas复用

```typescript
// ✗ 每次都创建新Canvas
getMaskResult() {
  const canvas = document.createElement('canvas');
  // ...合成
  return new AutoMaskResult(canvas);
}

// ✓ 复用父类的maskCanvas
class AutoMaskResult extends BaseMaskResult {
  constructor(image, layers) {
    super(image);  // 父类创建maskCanvas
    // 直接在this.maskCanvas上绘制
    const ctx = this.maskCanvas.getContext('2d');
    // ...
  }
}
```

#### 优化4：延迟释放

```typescript
release() {
  // 不是立即释放，而是设为最小尺寸
  this.autoMaskLayers.forEach(layer => {
    layer.maskCanvas.width = 1;   // 释放内存
    layer.maskCanvas.height = 1;
  });
  
  this.layerMap.clear();  // 清空映射
}
```

### 10.3 内存管理

#### 内存占用分析

```
假设：50层，每层1024×768像素

每层占用：
  maskCanvas: 1024 × 768 × 4字节 = 3MB
  RLE数据：约100KB（压缩后）
  其他数据：可忽略

总占用：
  50层 × 3MB = 150MB（Canvas）
  50层 × 100KB = 5MB（RLE）
  pickCanvas：3MB
  
  总计：约158MB
```

#### 优化建议

```typescript
// 1. 限制层数
const MAX_LAYERS = 50;
const limitedMasks = autoMasks.slice(0, MAX_LAYERS);

// 2. 按需解码
class LazyAutoMaskModel extends AutoMaskModel {
  private decodedLayers = new Set<string>();
  
  pickLayer(x, y) {
    const layer = super.pickLayer(x, y);
    
    if (layer && !this.decodedLayers.has(layer.id)) {
      // 首次访问时才解码
      layer.maskCanvas = rleToMask(...);
      this.decodedLayers.add(layer.id);
    }
    
    return layer;
  }
}

// 3. 定期清理
class ManagedEditor {
  private model: AutoMaskModel;
  
  switchImage(newUrl: string) {
    // 释放旧模型
    this.model?.release();
    
    // 创建新模型
    this.model = await factory.createAutoMaskModel(newUrl);
  }
}
```

### 10.4 错误处理

```typescript
class RobustAutoMaskModel extends AutoMaskModel {
  pickLayer(x, y) {
    try {
      // 边界检查
      if (x < 0 || x >= this.image.naturalWidth ||
          y < 0 || y >= this.image.naturalHeight) {
        console.warn('点击位置超出图片范围');
        return null;
      }
      
      return super.pickLayer(x, y);
    } catch (error) {
      console.error('拾取层失败:', error);
      return null;
    }
  }
  
  toggleLayerMode(x, y) {
    try {
      return super.toggleLayerMode(x, y);
    } catch (error) {
      console.error('切换模式失败:', error);
      // 尝试恢复
      this.reset();
      return null;
    }
  }
}
```

---

## 总结

### 核心要点回顾

**AutoMaskModel的本质**：
- 一个**状态机**：管理多个层的选择状态
- 一个**选择器**：通过颜色ID快速定位层
- 一个**合成器**：将多个层合成为最终结果

**关键技术**：
1. **RLE解码**：将压缩数据还原为Canvas
2. **颜色ID**：O(1)时间复杂度的层拾取
3. **智能切换**：根据上下文自动决定模式
4. **Canvas合成**：利用混合模式实现正负选区

**设计亮点**：
- 分离关注点（数据 vs 渲染）
- 高性能（颜色ID、按需合成）
- 易用性（一个方法完成复杂逻辑）
- 可扩展（状态导出/恢复、撤销/重做）

### 学习建议

1. **动手实践**：创建一个简单的编辑器
2. **阅读源码**：理解每个细节的实现
3. **性能测试**：对比不同方案的性能
4. **扩展功能**：添加自己的增强功能

### 进一步探索

- 如何支持多边形选区？
- 如何实现渐变边缘？
- 如何优化大图片的性能？
- 如何与其他编辑工具集成？

---

**文档版本**：v1.0  
**最后更新**：2026-01-19  
**作者**：资深前端专家 & 大模型技术讲师  
**适用于**：@lego/sam v1.1.1+
