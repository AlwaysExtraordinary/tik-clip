/**
 * @file config.ts
 * @description 3D Coverflow 视觉表现、物理阻尼、三维布局与动画配置中心
 * 集中统一管理倒影不透明度、边界弹簧弹性系数、惯性阻尼、相机视口、卡片体量尺寸及光盘展开飞行动画参数。
 */

/** 倒影与地面反光调节参数 */
export const REFLECTION_CONFIG = {
  opacityDark: 0.22, // 暗色主题下倒影不透明度 (0.15 ~ 0.28)
  opacityLight: 0.15, // 亮色主题下倒影不透明度 (0.10 ~ 0.20)
  blurRadius: 2, // 倒影磨砂模糊半径 (单位 px，0 为完全镜面)
  gap: 0.015, // 封面底边与倒影之间的微小空隙 (避免贴合重叠与 Z-fighting)
} as const;

/** 详情模式边界弹性回弹参数 (物理弹簧阻尼模型) */
export const BOUNCE_CONFIG = {
  stiffness: 0.05, // 弹簧劲度系数 (数值越大拉回越快)
  damping: 0.85, // 阻尼衰减系数 (0.75 ~ 0.88)
  impulse: 0.13, // 单次触碰边界施加的物理冲量大小
  maxVelocity: 0.22, // 冲量最大速度上限 (防多次快速点击突兀)
  maxOffset: 0.4, // 封面最大回弹位移限制幅度 (世界坐标)
  tiltRatio: 0.2, // 回弹时 Y 轴侧向微倾联动比例 (增强 3D 物理质感)
} as const;

/** 动画过渡与平滑插值速度 (Lerp Speed) */
export const LERP_CONFIG = {
  cardSpeed: 0.12, // 卡片位置、旋转与缩放插值速度 (0.08 ~ 0.18)
  cameraSpeed: 0.1, // 相机推拉镜头平滑插值速度 (0.06 ~ 0.15)
} as const;

/** 列表模式滚动与惯性物理参数 */
export const SCROLL_CONFIG = {
  sensitivity: 0.0012, // 滚轮连续滚动灵敏度
  dragFactor: 350, // 鼠标/触摸拖拽滚动阻尼系数 (数值越大拖拽位移越平缓)
  friction: 0.88, // 列表惯性滚动摩擦阻力 (数值越接近 1 滑行越远)
  followSpeed: 0.1, // 列表目标滚动位置的平滑追随速度
} as const;

/** 聚焦与详情模式滚轮切卡阈值 */
export const WHEEL_CONFIG = {
  stepThreshold: 50, // 滚轮累积滑动触发单张切卡的阻尼阈值
  stepCooldown: 180, // 滚轮切卡最小冷却时间 (毫秒，过滤惯性连跳)
  accumulatorResetTime: 300, // 滚轮静止重置累加器时间 (毫秒)
} as const;

/** 卡片模型基础尺寸与间距 */
export const CARD_CONFIG = {
  height: 4.2,
  width: 4.2 * (379.5 / 537), // 约 2.97
  depth: 4.2 * (41 / 537), // 约 0.32
  spacing: 2, // 列表卡片默认间距
} as const;

/** 相机与场景基础参数 */
export const CAMERA_CONFIG = {
  fov: 45, // 相机垂直视场角 (度)
  baseZ: 9.5, // 相机基准 Z 轴距离
} as const;

/** 主题配色 */
export const THEME_CONFIG = {
  bgColorDark: '#121214',
  bgColorLight: '#f3f4f6',
  plasticEdgeDark: '#1e293b',
  plasticEdgeLight: '#e2e8f0',
} as const;

/** 3D 播放过渡动画与实体光盘视觉调节参数 */
export const BOOK_ANIM_CONFIG = {
  thickness: 0.03, // 封面单板物理厚度

  // 宽屏模式参数 (Wide Mode, >= @3xl: 768px, 左右布局)
  wide: {
    duration: 2200, // 翻开与光盘飞行动画总时长 (毫秒)
    coverOpenMaxAngle: -Math.PI, // 封面翻转展开弧度 -180° (-π)，双页完全对折展平
    coverOpenRatio: 0.4, // 阶段 1 封面展开就位时间占比 (0.0 ~ 1.0)
    discDetachRightOffset: 0.38, // 阶段 2 光盘向右脱离托盘的位移距离 (世界单位)
    discDetachLiftZ: 0.18, // 阶段 2 光盘脱离托盘拔起高度 (世界单位)
    discFlyoutScale: 1.55, // 光盘飞至视野中心时的放大倍率
    discFlyoutZOffset: 2.0, // 光盘飞向相机的 Z 轴推进位移 (世界单位)
    discSpinAngle: Math.PI * 2, // 旋转总弧度 (360 度一整圈)
    flightTiltX: 0.08, // 飞行中段 X 轴立体微俯仰倾角系数
    flightTiltY: 0.06, // 飞行中段 Y 轴立体微偏航倾角系数
  },

  // 窄屏模式参数 (Narrow Mode, < @3xl: 768px, 上下布局)
  narrow: {
    duration: 2000, // 窄屏飞碟滑出与飞行动画总时长 (毫秒)
    slideOutRatio: 0.4, // 阶段 A 沿 Y 轴向下滑出脱离封面时间占比 (0.0 ~ 1.0)
    exitMargin: 0.5, // 光碟滑离封面下沿时的额外安全间隙 (世界单位)
    xAlignRatio: 0.2, // 阶段 A 下滑过程中 X 轴向视野中心微对齐权重系数
    discFlyoutScale: 2.0, // 光盘飞至视野中心时的放大倍率
    discFlyoutZOffset: 2.0, // 光盘飞向相机的 Z 轴推进位移 (世界单位)
    discSpinAngle: Math.PI * 2, // 旋转总弧度 (360 度一整圈)
    flightTiltX: 0.08, // 飞行中段 X 轴立体微俯仰倾角系数
    flightTiltY: 0.04, // 飞行中段 Y 轴立体微偏航倾角系数
    edgeInertiaOffset: 0.09, // 光盘触碰/脱离封面边缘时封面的微小惯性位移幅度 (世界单位)
    openInertiaDuration: 320, // 展开时光盘向下滑到边缘时封面惯性位移与恢复时长 (毫秒)
    closeInertiaDuration: 320, // 收合时光盘向上滑接触边缘时封面惯性位移与恢复时长 (毫秒)
  },

  // 内页 Canvas 贴图尺寸与装饰边框参数 (双端通用)
  canvas: {
    width: 600, // 内页基础设计宽度 (px)
    height: 850, // 内页基础设计高度 (px)
    scale: 3, // 贴图高分辨率超采样倍率 (3x 超采样达到 1800x2550 超清分辨率，杜绝 3D 渲染模糊)
    borderOuterPadding: 30, // 双层装饰外边框边距 (px)
    borderInnerPadding: 38, // 双层装饰内边框边距 (px)
    borderLineWidth: 1.5, // 装饰边框线条粗细 (px)
  },

  // 实体光盘几何与视觉效果参数 (双端通用)
  disc: {
    centerY: 330, // 光盘垂直中心 Y 坐标 (px)
    outerRadius: 200, // 光盘外边缘半径 (px)
    recessOffset: 8, // 托盘塑料凹槽相较光盘外径的扩张边距 (px)
    holeRadius: 24, // 光盘中心透空圆孔半径 (px)
    hubRadius: 50, // 光盘透明亚克力夹持环外径 (px)
    mirrorRadius: 40, // 光盘中心金属反光压合圈半径 (px)
    sheenOpacity: 0.22, // 光盘微彩光反射强度 (0.0 ~ 1.0)
  },

  // 内页影片典藏排版文字位置与尺寸
  typography: {
    titleY: 600, // 影片标题中心 Y 坐标 (px)
    titleFontSize: 22, // 影片标题字号 (px)
    actorY: 635, // 演员标签 Y 坐标 (px)
    actorValueY: 656, // 演员正文 Y 坐标 (px)
    categoryY: 692, // 类别标签 Y 坐标 (px)
    categoryValueY: 713, // 类别正文 Y 坐标 (px)
    singleMetaY: 650, // 仅单项元数据时的标签 Y 坐标 (px)
    singleMetaValueY: 673, // 仅单项元数据时的正文 Y 坐标 (px)
    metaLabelFontSize: 13, // 演员/类别标签字号 (px)
    metaValueFontSize: 14, // 演员/类别正文字号 (px)
    metaFontSize: 14, // 演员/类别元数据字号 (px)
    descHeaderY: 600, // 左内页简介标题 Y 坐标 (px)
    descHeaderFontSize: 15, // 左内页简介标题字号 (px)
    descContentY: 638, // 左内页简介正文起始 Y 坐标 (px)
    descContentFontSize: 13, // 左内页简介正文字号 (px)
    descLineHeight: 23, // 左内页简介正文行高 (px)
  },

  // 封面后撤与渐隐参数 (在光盘飞出快结束时触发)
  retreat: {
    preFlipDuration: 300, // 播放前若处于背面，翻转回正面的过渡时长 (毫秒)
    startRatio: 0.4, // 封面后撤开始触发的时间比例 (0.0 ~ 1.0)
    fadeStartRatio: 0.45, // 封面渐隐开始触发的时间比例 (0.0 ~ 1.0)
    distance: 1.2, // 封面沿 Z 轴向深处后撤位移 (世界坐标单位)
    minOpacity: 0.0, // 封面渐隐结束时的最终不透明度 (0.0 为完全隐去)
  },
} as const;
