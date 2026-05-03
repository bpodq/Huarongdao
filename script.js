/**
 * 华容道游戏 - JavaScript实现
 * 
 * 游戏规则：
 * 1. 棋盘为4x5的网格（4列5行）
 * 2. 曹操（2x2方块）需要从上方移动到底部中央出口
 * 3. 其他武将（关羽2x1、张飞/赵云/马超/黄忠1x2）和士兵（1x1）可阻挡或辅助移动
 * 4. 目标是用最少步数将曹操移出出口
 * 
 * 功能特性：
 * - 支持4种不同开局布局
 * - 鼠标拖拽和键盘方向键控制
 * - 自动求解功能（BFS算法）
 * - 图片显示人物形象
 * - 移动步数统计
 * 
 * 文件结构：
 * - script.js - 游戏核心逻辑
 * - index.html - 游戏界面
 * - style.css - 样式文件
 * - images/ - 人物图片目录
 */

// 游戏画布和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI元素引用
const movesElement = document.getElementById('moves');    // 步数显示
const resetBtn = document.getElementById('resetBtn');    // 重置按钮
const solveBtn = document.getElementById('solveBtn');    // 自动求解按钮
const layoutSelect = document.getElementById('layoutSelect'); // 布局选择

// 图片缓存对象：key为图片标识，value为Image对象
const images = {};

/**
 * 加载人物图片资源
 * 
 * 图片命名规则：
 * - 曹操：单个图片 '曹操'
 * - 士兵：单个图片 '小兵'
 * - 武将：1为竖版(1x2), 2为横版(2x1)，如 '关羽1', '关羽2'
 * 
 * @returns {void}
 */
function loadImages() {
    // 需要加载的图片列表
    const imageList = [
        { key: '曹操', file: 'images/曹操.jpg' },
        { key: '关羽1', file: 'images/关羽1.jpg' },
        { key: '关羽2', file: 'images/关羽2.jpg' },
        { key: '张飞1', file: 'images/张飞1.jpg' },
        { key: '张飞2', file: 'images/张飞2.jpg' },
        { key: '赵云1', file: 'images/赵云1.jpg' },
        { key: '赵云2', file: 'images/赵云2.jpg' },
        { key: '马超1', file: 'images/马超1.jpg' },
        { key: '马超2', file: 'images/马超2.jpg' },
        { key: '黄忠1', file: 'images/黄忠1.jpg' },
        { key: '黄忠2', file: 'images/黄忠2.jpg' },
        { key: '小兵', file: 'images/小兵.jpg' },
    ];

    // 已加载图片计数器
    let loaded = 0;
    
    // 遍历加载每张图片
    imageList.forEach(item => {
        const img = new Image();
        // 加载完成或失败都计数，确保所有图片都处理完后再绘制
        img.onload = img.onerror = () => {
            loaded++;
            // 所有图片加载完成后初始化绘制
            if (loaded >= imageList.length) drawBoard();
        };
        img.src = item.file;
        images[item.key] = img;
    });
}

// 游戏配置常量
let gridSize = 140; // 每个格子的像素大小
const cols = 4;       // 棋盘列数（4列）
const rows = 5;       // 棋盘行数（5行）

/**
 * 方块类型定义
 * 
 * 每个方块包含：
 * - name: 显示名称
 * - width: 宽度（格子数）
 * - height: 高度（格子数）
 * - color: 默认颜色（当图片加载失败时显示）
 * 
 * 方块大小说明：
 * - 曹操：2x2（占据4格）
 * - 关羽：2x1（横放，占据2格）
 * - 张飞/赵云/马超/黄忠：1x2（竖放，占据2格）
 * - 士兵：1x1（占据1格）
 */
const BLOCKS = {
    CAO_CAO: { name: '曹操', width: 2, height: 2, color: '#FF5722' },    // 红色
    ZHANG_FE: { name: '张飞', width: 1, height: 2, color: '#4CAF50' },   // 绿色
    ZHAO_YUN: { name: '赵云', width: 1, height: 2, color: '#2196F3' },   // 蓝色
    MA_CHAO: { name: '马超', width: 1, height: 2, color: '#9C27B0' },    // 紫色
    HUANG_ZHONG: { name: '黄忠', width: 1, height: 2, color: '#FF9800' }, // 橙色
    GUAN_YU: { name: '关羽', width: 2, height: 1, color: '#607D8B' },    // 灰色
    SOLDIER: { name: '士兵', width: 1, height: 1, color: '#9E9E9E' }     // 浅灰色
};

/**
 * 游戏状态变量
 */
let blocks = [];              // 当前所有方块的数组
let selectedBlock = null;     // 当前选中的方块（用于键盘控制）
let moves = 0;                // 移动步数计数器
let gameOver = false;         // 游戏是否结束
let isDragging = false;       // 是否正在拖拽
let dragStartX = 0;           // 拖拽开始时的鼠标X坐标
let dragStartY = 0;           // 拖拽开始时的鼠标Y坐标
let dragStartGridX = 0;       // 拖拽开始时的格子X坐标
let dragStartGridY = 0;       // 拖拽开始时的格子Y坐标

/**
 * 开局布局方案数组
 * 
 * 每个布局包含：
 * - name: 布局名称（显示在下拉菜单中）
 * - blocks: 方块初始位置配置
 * 
 * 布局难度说明：
 * - 方案一：经典布局，难度适中，最常见的华容道开局
 * - 方案二：双横武将，难度较低
 * - 方案三：三横武将，难度较高
 * - 方案四：四横武将，难度最高
 * - 方案五：五横武将，难度极高
 */
const LAYOUTS = [
    // 方案一 - 经典布局（最经典的华容道布局）
    {
        name: "方案一 - 经典布局",
        blocks: [
            { ...BLOCKS.CAO_CAO, x: 1, y: 0, id: 'caocao' },     // 曹操在顶部中央
            { ...BLOCKS.MA_CHAO, x: 0, y: 0, id: 'machao' },     // 马超在左上角
            { ...BLOCKS.HUANG_ZHONG, x: 3, y: 0, id: 'huangzhong' }, // 黄忠在右上角
            { ...BLOCKS.GUAN_YU, x: 1, y: 2, id: 'guanyu' },     // 关羽横放在中间
            { ...BLOCKS.ZHANG_FE, x: 0, y: 2, id: 'zhangfei' },  // 张飞在左中
            { ...BLOCKS.ZHAO_YUN, x: 3, y: 2, id: 'zhaoyun' },   // 赵云在右中
            { ...BLOCKS.SOLDIER, x: 1, y: 3, id: 'soldier1' },   // 士兵分布在底部
            { ...BLOCKS.SOLDIER, x: 2, y: 3, id: 'soldier2' },
            { ...BLOCKS.SOLDIER, x: 0, y: 4, id: 'soldier3' },
            { ...BLOCKS.SOLDIER, x: 3, y: 4, id: 'soldier4' }
        ]
    },
    // 方案二 - 双横武将（关羽和张飞横放）
    {
        name: "方案二 - 双横武将",
        blocks: [
            { ...BLOCKS.MA_CHAO, x: 0, y: 0, id: 'machao' },
            { ...BLOCKS.CAO_CAO, x: 1, y: 0, id: 'caocao' },
            { ...BLOCKS.HUANG_ZHONG, x: 3, y: 0, id: 'huangzhong' },
            { ...BLOCKS.ZHAO_YUN, x: 0, y: 2, id: 'zhaoyun' },
            { ...BLOCKS.GUAN_YU, x: 1, y: 2, id: 'guanyu' },
            { ...BLOCKS.SOLDIER, x: 3, y: 2, id: 'soldier1' },
            { name: '张飞', width: 2, height: 1, color: '#4CAF50', x: 1, y: 3, id: 'zhangfei' }, // 张飞横放
            { ...BLOCKS.SOLDIER, x: 3, y: 3, id: 'soldier2' },
            { ...BLOCKS.SOLDIER, x: 0, y: 4, id: 'soldier3' },
            { ...BLOCKS.SOLDIER, x: 3, y: 4, id: 'soldier4' }
        ]
    },
    // 方案三 - 三横武将（关羽、张飞、赵云横放）
    {
        name: "方案三 - 三横武将",
        blocks: [
            { ...BLOCKS.MA_CHAO, x: 0, y: 0, id: 'machao' },
            { ...BLOCKS.CAO_CAO, x: 1, y: 0, id: 'caocao' },
            { ...BLOCKS.HUANG_ZHONG, x: 3, y: 0, id: 'huangzhong' },
            { ...BLOCKS.GUAN_YU, x: 0, y: 2, id: 'guanyu' },
            { name: '张飞', width: 2, height: 1, color: '#4CAF50', x: 2, y: 2, id: 'zhangfei' },
            { name: '赵云', width: 2, height: 1, color: '#2196F3', x: 0, y: 3, id: 'zhaoyun' }, // 赵云横放
            { ...BLOCKS.SOLDIER, x: 2, y: 3, id: 'soldier1' },
            { ...BLOCKS.SOLDIER, x: 3, y: 3, id: 'soldier2' },
            { ...BLOCKS.SOLDIER, x: 0, y: 4, id: 'soldier3' },
            { ...BLOCKS.SOLDIER, x: 3, y: 4, id: 'soldier4' }
        ]
    },
    // 方案四 - 四横武将（关羽、张飞、赵云、黄忠全部横放）
    {
        name: "方案四 - 四横武将",
        blocks: [
            { ...BLOCKS.MA_CHAO, x: 0, y: 0, id: 'machao' },
            { ...BLOCKS.CAO_CAO, x: 1, y: 0, id: 'caocao' },
            { ...BLOCKS.SOLDIER, x: 3, y: 0, id: 'soldier1' },
            { ...BLOCKS.SOLDIER, x: 3, y: 1, id: 'soldier2' },
            { ...BLOCKS.GUAN_YU, x: 0, y: 2, id: 'guanyu' },
            { name: '张飞', width: 2, height: 1, color: '#4CAF50', x: 2, y: 2, id: 'zhangfei' },
            { name: '赵云', width: 2, height: 1, color: '#2196F3', x: 0, y: 3, id: 'zhaoyun' },
            { name: '黄忠', width: 2, height: 1, color: '#FF9800', x: 2, y: 3, id: 'huangzhong' }, // 黄忠横放
            { ...BLOCKS.SOLDIER, x: 0, y: 4, id: 'soldier3' },
            { ...BLOCKS.SOLDIER, x: 3, y: 4, id: 'soldier4' }
        ]
    },
    // 方案五 - 五横武将（马超、关羽、张飞、赵云、黄忠全部横放）
    // 棋盘4x5=20格，曹操2x2=4格，5个横将5x2=10格，4个士兵4x1=4格，共18格
    // 布局设计：5个横将错开排列，士兵填补空隙
    {
        name: "方案五 - 五横武将",
        blocks: [
            // 第一行：马超(0,0)、士兵(2,0)、士兵(3,0)
            { name: '马超', width: 2, height: 1, color: '#9C27B0', x: 0, y: 0, id: 'machao' },
            { ...BLOCKS.SOLDIER, x: 2, y: 0, id: 'soldier1' },
            { ...BLOCKS.SOLDIER, x: 3, y: 0, id: 'soldier2' },
            // 第二行：关羽(0,1)、曹操(2,1)
            { name: '关羽', width: 2, height: 1, color: '#607D8B', x: 0, y: 1, id: 'guanyu' },
            { ...BLOCKS.CAO_CAO, x: 2, y: 1, id: 'caocao' },
            // 第三行：曹操(2,2)占据下方两格
            // 第四行：张飞(0,3)、黄忠(2,3)
            { name: '张飞', width: 2, height: 1, color: '#4CAF50', x: 0, y: 3, id: 'zhangfei' },
            { name: '黄忠', width: 2, height: 1, color: '#FF9800', x: 2, y: 3, id: 'huangzhong' },
            // 第五行：赵云(0,4)、士兵(2,4)、士兵(3,4)
            { name: '赵云', width: 2, height: 1, color: '#2196F3', x: 0, y: 4, id: 'zhaoyun' },
            { ...BLOCKS.SOLDIER, x: 2, y: 4, id: 'soldier3' },
            { ...BLOCKS.SOLDIER, x: 3, y: 4, id: 'soldier4' }
        ]
    }
];

/**
 * 初始化游戏布局
 * 
 * 根据用户选择的布局方案，初始化方块数组
 * 使用展开运算符复制对象，避免引用问题
 * 
 * @returns {void}
 */
function initBlocks() {
    // 获取用户选择的布局索引
    const layoutIndex = parseInt(document.getElementById('layoutSelect').value);
    const selectedLayout = LAYOUTS[layoutIndex];
    // 深拷贝布局中的每个方块，创建游戏状态
    blocks = selectedLayout.blocks.map(block => ({ ...block }));
}

/**
 * 绘制游戏棋盘和所有方块
 * 
 * 绘制流程：
 * 1. 清空画布
 * 2. 绘制网格线（出口区域不绘制底部横线）
 * 3. 绘制每个方块的人物图片
 * 4. 图片裁剪处理：确保图片按目标比例显示
 * 
 * @returns {void}
 */
function drawBoard() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景网格线
    ctx.strokeStyle = '#e0e0e0'; // 网格线颜色
    
    // 绘制垂直线（列分隔线）
    for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0); // 从顶部开始
        ctx.lineTo(i * gridSize, canvas.height - 20); // 到出口上方结束（底部20px为出口区域）
        ctx.stroke();
    }
    
    // 绘制水平线（行分隔线）
    for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize); // 从左侧开始
        ctx.lineTo(canvas.width, i * gridSize); // 到右侧结束
        ctx.stroke();
    }
    
    // 绘制出口标记（底部中央的出口区域）
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(gridSize, canvas.height - 20, gridSize * 2, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('出口', canvas.width / 2, canvas.height - 8);
    
    // 遍历绘制每个方块
    blocks.forEach(block => {
        // 根据角色和方向选择正确的图片
        let imageKey;
        if (block.name === '曹操') {
            imageKey = '曹操';           // 曹操只有一个图片
        } else if (block.name === '士兵') {
            imageKey = '小兵';           // 士兵只有一个图片
        } else {
            // 武将：宽度>高度为横版(后缀2)，否则为竖版(后缀1)
            imageKey = block.width > block.height ? `${block.name}2` : `${block.name}1`;
        }
        
        const image = images[imageKey];
        // 如果图片未加载完成则跳过绘制
        if (!image || !image.naturalWidth) return;

        // 计算目标尺寸（留出2px边距）
        const destW = block.width * gridSize - 2;
        const destH = block.height * gridSize - 2;
        const targetRatio = destW / destH;

        // 计算图片裁剪区域（确保按目标比例显示）
        let srcX, srcY, srcW, srcH;
        const imgRatio = image.naturalWidth / image.naturalHeight;
        
        if (imgRatio > targetRatio) {
            // 图片偏宽，裁剪左右两侧
            srcH = image.naturalHeight;
            srcW = srcH * targetRatio;
            srcX = (image.naturalWidth - srcW) / 2;  // 居中裁剪
            srcY = 0;
        } else {
            // 图片偏高，裁剪上下两侧
            srcW = image.naturalWidth;
            srcH = srcW / targetRatio;
            srcX = 0;
            // 横将图片往上偏移50px，避免头部被裁
            const cropShift = block.width > block.height ? -50 : 0;
            srcY = (image.naturalHeight - srcH) / 2 + cropShift;
            if (srcY < 0) srcY = 0;
        }

        ctx.drawImage(image, srcX, srcY, srcW, srcH,
            block.x * gridSize, block.y * gridSize, destW, destH);
    });
}

/**
 * 检查方块是否可以移动到指定位置
 * 
 * 检查逻辑：
 * 1. 边界检查：确保方块完全在棋盘内
 * 2. 碰撞检查：确保不与其他方块重叠
 * 
 * @param {Object} block - 要移动的方块对象
 * @param {number} newX - 目标X坐标（格子数）
 * @param {number} newY - 目标Y坐标（格子数）
 * @returns {boolean} - 是否可以移动
 */
function canMove(block, newX, newY) {
    // 边界检查：确保方块不会超出棋盘范围
    if (newX < 0 ||                          // 左边超出
        newX + block.width > cols ||          // 右边超出
        newY < 0 ||                          // 上边超出
        newY + block.height > rows) {        // 下边超出
        return false;
    }
    
    // 碰撞检查：检查是否与其他方块重叠
    for (let otherBlock of blocks) {
        if (otherBlock === block) continue;  // 跳过自己
        
        // 使用分离轴定理检查两个矩形是否重叠
        // 不重叠条件：一个方块完全在另一个方块的左边、右边、上边或下边
        if (!(newX + block.width <= otherBlock.x ||       // 当前方块在另一个方块左边
              newX >= otherBlock.x + otherBlock.width ||  // 当前方块在另一个方块右边
              newY + block.height <= otherBlock.y ||      // 当前方块在另一个方块上边
              newY >= otherBlock.y + otherBlock.height)) { // 当前方块在另一个方块下边
            return false;  // 有重叠，不能移动
        }
    }
    
    return true;
}

/**
 * 移动方块到新位置
 * 
 * @param {Object} block - 要移动的方块对象
 * @param {number} dx - X方向移动量（格子数）
 * @param {number} dy - Y方向移动量（格子数）
 * @param {boolean} [incrementMoves=true] - 是否增加步数计数
 * @returns {boolean} - 是否移动成功
 */
function moveBlock(block, dx, dy, incrementMoves = true) {
    const newX = block.x + dx;
    const newY = block.y + dy;
    
    if (canMove(block, newX, newY)) {
        // 更新方块位置
        block.x = newX;
        block.y = newY;
        
        // 如果需要计数，增加步数
        if (incrementMoves) {
            moves++;
            movesElement.textContent = moves;
        }
        
        // 重新绘制棋盘
        drawBoard();
        
        // 检查是否达到胜利条件
        checkWin();
        
        return true;
    }
    return false;
}

/**
 * 检查胜利条件
 * 
 * 胜利条件：曹操（2x2方块）移动到底部中央位置 (x: 1, y: 3)
 * 此时曹操正好对准出口，可以逃出华容道
 * 
 * @returns {void}
 */
function checkWin() {
    // 找到曹操方块
    const caoCao = blocks.find(block => block.name === '曹操');
    
    // 检查是否到达目标位置
    if (caoCao && caoCao.x === 1 && caoCao.y === 3) {
        gameOver = true;
        // 延迟0.5秒显示胜利提示，让动画完成
        setTimeout(() => {
            alert(`恭喜你！用了 ${moves} 步完成了华容道！`);
        }, 500);
    }
}

/**
 * 处理键盘输入事件
 * 
 * 操作方式：
 * 1. 先用鼠标点击选中一个方块
 * 2. 使用方向键（上、下、左、右）移动选中的方块
 * 3. 移动成功后自动取消选中状态
 * 
 * @param {KeyboardEvent} e - 键盘事件对象
 * @returns {void}
 */
function handleKeyPress(e) {
    // 如果游戏结束，忽略键盘输入
    if (gameOver) return;
    
    // 方向键键码定义
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;
    
    // 只有选中方块后才能使用方向键移动
    if (selectedBlock) {
        let moved = false;
        
        // 根据按键方向移动方块
        switch (e.keyCode) {
            case LEFT_KEY:
                moved = moveBlock(selectedBlock, -1, 0, true);
                break;
            case RIGHT_KEY:
                moved = moveBlock(selectedBlock, 1, 0, true);
                break;
            case UP_KEY:
                moved = moveBlock(selectedBlock, 0, -1, true);
                break;
            case DOWN_KEY:
                moved = moveBlock(selectedBlock, 0, 1, true);
                break;
        }
        
        // 移动成功后取消选中状态
        if (moved) {
            selectedBlock = null;
        }
    }
}

/**
 * 处理鼠标按下事件
 * 
 * 记录拖拽开始时的位置，用于后续计算拖拽方向和距离
 * 
 * @param {MouseEvent} e - 鼠标事件对象
 * @returns {void}
 */
function handleMouseDown(e) {
    // 如果游戏结束，忽略鼠标事件
    if (gameOver) return;
    
    // 获取画布在页面中的位置和尺寸
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标相对于画布左上角的坐标
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 忽略点击出口区域（底部20px）
    if (mouseY >= canvas.height - 20) return;
    
    // 将像素坐标转换为格子坐标
    const gridX = Math.floor(mouseX / gridSize);
    const gridY = Math.floor(mouseY / gridSize);
    
    // 查找被点击的方块
    for (let block of blocks) {
        // 检查点击位置是否在方块范围内
        if (gridX >= block.x && gridX < block.x + block.width && 
            gridY >= block.y && gridY < block.y + block.height) {
            selectedBlock = block;
            isDragging = true;
            dragStartX = mouseX;
            dragStartY = mouseY;
            dragStartGridX = gridX;
            dragStartGridY = gridY;
            return;
        }
    }
    
    // 如果点击了空白区域，取消选择
    selectedBlock = null;
    isDragging = false;
}

/**
 * 处理鼠标移动事件
 * 
 * 本游戏采用"点击-拖动-释放"模式，移动逻辑在鼠标释放时处理
 * 因此此函数只需检查拖动状态，不进行实际计算
 * 
 * @param {MouseEvent} e - 鼠标事件对象
 * @returns {void}
 */
function handleMouseMove(e) {
    // 如果游戏结束或未在拖动，忽略事件
    if (gameOver || !isDragging) return;
}

/**
 * 处理鼠标释放事件
 * 
 * 这是拖拽操作的核心逻辑，计算拖拽距离和方向并执行移动
 * 
 * 移动逻辑：
 * 1. L型移动：同时在X和Y方向有位移时，尝试两种顺序的移动
 * 2. 水平移动：只在X方向有位移
 * 3. 垂直移动：只在Y方向有位移
 * 4. 多格移动：超过一格的移动需要逐格尝试
 * 
 * @param {MouseEvent} e - 鼠标事件对象
 * @returns {void}
 */
function handleMouseUp(e) {
    // 如果游戏结束、未在拖动或没有选中方块，重置状态并返回
    if (gameOver || !isDragging || !selectedBlock) {
        isDragging = false;
        selectedBlock = null;
        return;
    }
    
    // 获取画布位置并计算鼠标相对于画布的坐标
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 将像素坐标转换为格子坐标
    const gridX = Math.floor(mouseX / gridSize);
    const gridY = Math.floor(mouseY / gridSize);
    
    // 计算拖拽的格子位移量
    const deltaGridX = gridX - dragStartGridX;
    const deltaGridY = gridY - dragStartGridY;
    
    // 保存当前方块引用（用于闭包中）
    const currentBlock = selectedBlock;
    
    // 记录是否移动成功
    let moved = false;
    
    // 情况一：L型移动（同时有水平和垂直位移）
    if (deltaGridX !== 0 && deltaGridY !== 0) {
        // 尝试两种移动顺序，只要有一种成功就算移动成功
        
        // 尝试顺序1：先水平移动，再垂直移动
        if (moveBlock(currentBlock, deltaGridX, 0, false)) {
            moved = true;
            // 延迟100ms后执行垂直移动（动画效果）
            setTimeout(() => {
                moveBlock(currentBlock, 0, deltaGridY, false);
                // 两个方向都移动完成后增加步数
                moves++;
                movesElement.textContent = moves;
            }, 100);
        } else {
            // 顺序1失败，尝试顺序2：先垂直移动，再水平移动
            if (moveBlock(currentBlock, 0, deltaGridY, false)) {
                moved = true;
                setTimeout(() => {
                    moveBlock(currentBlock, deltaGridX, 0, false);
                    moves++;
                    movesElement.textContent = moves;
                }, 100);
            }
        }
    } 
    // 情况二：只有水平移动
    else if (deltaGridX !== 0) {
        // 多格移动（超过一格）
        if (Math.abs(deltaGridX) > 1) {
            let moveSuccess = true;
            // 逐格尝试移动
            for (let i = 0; i < Math.abs(deltaGridX); i++) {
                // 每次移动一格，方向由deltaGridX的正负决定
                if (!moveBlock(currentBlock, deltaGridX > 0 ? 1 : -1, 0, false)) {
                    moveSuccess = false;
                    break; // 某一格移动失败，停止尝试
                }
            }
            if (moveSuccess) {
                moved = true;
                // 所有格移动成功后增加步数
                moves++;
                movesElement.textContent = moves;
            }
        } else {
            // 移动一格
            if (moveBlock(currentBlock, deltaGridX, 0, true)) {
                moved = true;
            }
        }
    } else if (deltaGridY !== 0) {
        // 只有垂直移动
        if (Math.abs(deltaGridY) > 1) {
            // 尝试移动多格
            let moveSuccess = true;
            for (let i = 0; i < Math.abs(deltaGridY); i++) {
                if (!moveBlock(currentBlock, 0, deltaGridY > 0 ? 1 : -1, false)) {
                    moveSuccess = false;
                    break;
                }
            }
            if (moveSuccess) {
                moved = true;
                // 移动完成后增加步数
                moves++;
                movesElement.textContent = moves;
            }
        } else {
            // 移动一格
            if (moveBlock(currentBlock, 0, deltaGridY, true)) {
                moved = true;
            }
        }
    }
    
    // 结束拖动状态
    isDragging = false;
    selectedBlock = null;
}

/**
 * 重置游戏
 * 
 * 将游戏恢复到初始状态：
 * 1. 重新初始化方块布局
 * 2. 重置步数为0
 * 3. 重置游戏状态标志
 * 4. 重新启用按钮
 * 5. 重新绘制棋盘
 * 
 * @returns {void}
 */
function resetGame() {
    // 重新初始化方块布局（根据当前选择的布局方案）
    initBlocks();
    
    // 重置步数
    moves = 0;
    movesElement.textContent = moves;
    
    // 重置游戏状态
    gameOver = false;
    selectedBlock = null;
    isSolving = false;
    
    // 重新启用按钮
    solveBtn.disabled = false;
    solveBtn.textContent = '自动求解';
    resetBtn.disabled = false;
    
    // 重新绘制棋盘
    drawBoard();
}

/**
 * 是否正在自动求解中（防止重复触发）
 */
let isSolving = false;

/**
 * 生成状态唯一标识键
 * 
 * 用于状态空间搜索时的去重，将方块布局转换为字符串键
 * 
 * 状态等价性优化：
 * - 所有士兵视为相同（用 's:x,y' 表示）
 * - 所有竖武将（1x2）视为相同（用 'g:x,y' 表示）
 * - 其他方块（曹操、关羽等）保留唯一标识
 * 
 * @param {Array} blocks - 方块数组
 * @returns {string} - 状态键字符串
 */
function getStateKey(blocks) {
    // 将每个方块转换为字符串表示，然后排序并连接
    return blocks.map(block => {
        if (block.id.startsWith('soldier')) {
            // 士兵：统一用 's' 表示
            return `s:${block.x},${block.y}`;
        }
        if (block.width === 1 && block.height === 2) {
            // 竖武将（1x2）：统一用 'g' 表示
            return `g:${block.x},${block.y}`;
        }
        // 其他方块（曹操、关羽等）：使用唯一ID
        return `${block.id}:${block.x},${block.y}`;
    }).sort().join('|');
}

/**
 * 克隆方块数组（深拷贝）
 * 
 * 用于状态空间搜索时创建独立的状态副本
 * 
 * @param {Array} blocks - 原始方块数组
 * @returns {Array} - 克隆后的方块数组
 */
function cloneBlocks(blocks) {
    // 使用展开运算符进行浅拷贝（方块对象是扁平化的，浅拷贝足够）
    return blocks.map(block => ({ ...block }));
}

/**
 * 检查状态中的方块是否可以移动到指定位置
 * 
 * 与 canMove() 类似，但接收独立的方块数组参数，不依赖全局 blocks
 * 用于自动求解算法中模拟状态转换
 * 
 * @param {Object} block - 要移动的方块
 * @param {Array} blocks - 当前状态的方块数组
 * @param {number} newX - 目标X坐标
 * @param {number} newY - 目标Y坐标
 * @returns {boolean} - 是否可以移动
 */
function canMoveState(block, blocks, newX, newY) {
    // 边界检查
    if (newX < 0 || 
        newX + block.width > cols || 
        newY < 0 || 
        newY + block.height > rows) {
        return false;
    }
    
    // 碰撞检查
    for (let otherBlock of blocks) {
        if (otherBlock.id === block.id) continue;
        
        if (!(newX + block.width <= otherBlock.x || 
              newX >= otherBlock.x + otherBlock.width || 
              newY + block.height <= otherBlock.y || 
              newY >= otherBlock.y + otherBlock.height)) {
            return false;
        }
    }
    
    return true;
}

/**
 * solvePuzzle - 华容道游戏求解器
 * 
 * 使用广度优先搜索（BFS）算法寻找从当前布局到目标状态的最优解
 * 目标状态：曹操（大方块）移动到棋盘底部中央位置 (x: 1, y: 3)
 * 
 * 算法特点：
 * 1. 状态空间搜索：遍历所有可能的游戏状态
 * 2. 广度优先：保证找到的是步数最少的解
 * 3. 访问集合：使用 Set 数据结构避免重复访问相同状态
 * 4. L型移动支持：除了直线滑动，还支持在拐角处连续滑动两个方向
 */
function solvePuzzle() {
    // 保存初始状态，以便在找不到解时恢复游戏状态
    const initialState = cloneBlocks(blocks);
    
    // BFS 队列：存储待探索的状态节点
    // 每个节点包含：blocks（当前布局）、moves（到达此状态的操作序列）
    const queue = [{ blocks: initialState, moves: [] }];
    
    // 已访问状态集合：存储已探索过的布局状态，防止重复搜索
    // 使用 getStateKey() 将二维布局转换为一维字符串键值
    const visited = new Set();
    visited.add(getStateKey(initialState));
    
    // 定义四个移动方向：上、下、左、右
    const directions = [
        { dx: 0, dy: -1, name: '上' },
        { dx: 0, dy: 1, name: '下' },
        { dx: -1, dy: 0, name: '左' },
        { dx: 1, dy: 0, name: '右' }
    ];
    
    // 存储找到的解决方案，若无法求解则为 null
    let solution = null;
    
    // 迭代计数器：防止搜索时间过长，设置最大迭代次数限制
    let iterations = 0;
    
    // 队列头指针：BFS 中当前正在处理的节点索引
    let head = 0;
    
    // 最大迭代次数：防止算法陷入无限循环
    const maxIterations = 10000000;

    // 记录求解过程的调试信息
    console.log('开始求解，初始状态:', getStateKey(initialState));
    console.log('曹操初始位置:', initialState.find(b => b.name === '曹操'));

    // BFS 主循环：依次处理队列中的每个状态
    while (head < queue.length && iterations < maxIterations) {
        iterations++;
        
        // 取出当前待处理的状态节点（使用指针避免出队开销）
        const current = queue[head++];
        
        // 检查是否达到目标状态：曹操位于 (1, 3) 位置
        // 华容道目标是将曹操移动到棋盘底部中央，底部第一行索引为3
        const caoCao = current.blocks.find(b => b.name === '曹操');
        if (caoCao && caoCao.x === 1 && caoCao.y === 3) {
            // 找到解决方案，记录解决步骤
            solution = current.moves;
            console.log('找到解决方案！步数:', solution.length, '迭代次数:', iterations);
            break;
        }
        
        // 第一类移动：直线滑动（上下左右四个方向）
        // 遍历当前状态中的每个方块，尝试向四个方向滑动
        for (let block of current.blocks) {
            for (let dir of directions) {
                // 克隆当前状态用于模拟滑动
                const slideBlocks = cloneBlocks(current.blocks);
                
                // 找到要滑动的方块（在克隆的状态中）
                const slideBlock = slideBlocks.find(b => b.id === block.id);
                
                // slideDist：记录此次滑动的总距离（以格子为单位）
                let slideDist = 0;

                // 持续滑动直到遇到障碍物
                // canMoveState() 检查移动后是否与其他方块或边界冲突
                while (canMoveState(slideBlock, slideBlocks, slideBlock.x + dir.dx, slideBlock.y + dir.dy)) {
                    // 执行滑动：更新方块坐标
                    slideBlock.x += dir.dx;
                    slideBlock.y += dir.dy;
                    slideDist++;

                    // 生成滑动后的状态键值
                    const stateKey = getStateKey(slideBlocks);
                    
                    // 如果是未访问过的新状态，加入队列等待后续处理
                    if (!visited.has(stateKey)) {
                        visited.add(stateKey);
                        queue.push({
                            blocks: cloneBlocks(slideBlocks),
                            // 记录移动操作：blockId-方块ID，dx/dy-总位移量
                            moves: [...current.moves, { blockId: block.id, dx: dir.dx * slideDist, dy: dir.dy * slideDist }]
                        });
                    }
                }
            }
        }

        // 第二类移动：L型拐弯移动
        // 在垂直或水平方向上连续滑动，然后拐弯继续滑动
        // 这种移动方式允许方块绕过障碍物，算作一步操作
        for (let block of current.blocks) {
            for (let dir1 of directions) {
                for (let dir2 of directions) {
                    // dir1.dx * dir2.dx + dir1.dy * dir2.dy !== 0
                    // 这个条件确保两个方向不是相反的（点积不为0表示不平行或相反）
                    // 我们只处理垂直方向的连续移动（第一段和第二段方向不同）
                    if (dir1.dx * dir2.dx + dir1.dy * dir2.dy !== 0) continue;

                    // 克隆状态用于模拟L型移动
                    const tempBlocks = cloneBlocks(current.blocks);
                    const tempBlock = tempBlocks.find(b => b.id === block.id);
                    
                    // k：第一段滑动的距离
                    let k = 0;

                    // 第一段：沿 dir1 方向持续滑动
                    while (canMoveState(tempBlock, tempBlocks, tempBlock.x + dir1.dx, tempBlock.y + dir1.dy)) {
                        tempBlock.x += dir1.dx;
                        tempBlock.y += dir1.dy;
                        k++;

                        // 克隆第一段滑动后的状态，用于模拟第二段
                        const cornerBlocks = cloneBlocks(tempBlocks);
                        const cornerBlock = cornerBlocks.find(b => b.id === block.id);
                        
                        // l：第二段滑动的距离
                        let l = 0;

                        // 第二段：沿 dir2 方向持续滑动
                        while (canMoveState(cornerBlock, cornerBlocks, cornerBlock.x + dir2.dx, cornerBlock.y + dir2.dy)) {
                            cornerBlock.x += dir2.dx;
                            cornerBlock.y += dir2.dy;
                            l++;

                            // 生成L型移动后的状态键值
                            const stateKey = getStateKey(cornerBlocks);
                            
                            // 同样是未访问过的新状态则加入队列
                            if (!visited.has(stateKey)) {
                                visited.add(stateKey);
                                queue.push({
                                    blocks: cloneBlocks(cornerBlocks),
                                    // L型移动的位移：两个方向位移的矢量和
                                    moves: [...current.moves, {
                                        blockId: block.id,
                                        dx: dir1.dx * k + dir2.dx * l,
                                        dy: dir1.dy * k + dir2.dy * l
                                    }]
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 打印求解统计信息
    console.log('求解结束，迭代次数:', iterations, '访问状态数:', visited.size);
    
    // 检查求解结果
    if (!solution) {
        console.log('未找到解决方案');
    }
    if (iterations >= maxIterations) {
        console.log('达到最大迭代次数:', maxIterations);
    }
    
    // 返回解决方案（移动序列），未找到解则返回 null
    return solution;
}

/**
 * 动画演示解决方案
 * 
 * 将求解器找到的移动序列逐步展示出来
 * 使用 async/await 实现平滑的动画效果
 * 
 * @param {Array} solution - 移动序列数组
 * @returns {void}
 */
async function animateSolution(solution) {
    // 标记正在求解中
    isSolving = true;
    
    // 禁用按钮防止重复操作
    solveBtn.disabled = true;
    resetBtn.disabled = true;
    
    // 遍历每个移动步骤
    for (let move of solution) {
        // 找到要移动的方块
        const block = blocks.find(b => b.id === move.blockId);
        
        if (block) {
            // 执行移动
            block.x += move.dx;
            block.y += move.dy;
            
            // 更新步数
            moves++;
            movesElement.textContent = moves;
            
            // 重新绘制棋盘
            drawBoard();
            
            // 检查胜利条件
            checkWin();
            
            // 等待300ms后执行下一步（动画间隔）
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // 求解完成，恢复状态
    isSolving = false;
    solveBtn.disabled = false;
    solveBtn.textContent = '自动求解';
    resetBtn.disabled = false;
}

/**
 * 触发自动求解功能
 * 
 * 调用 solvePuzzle() 进行状态空间搜索，找到解决方案后进行动画演示
 * 使用 setTimeout 异步执行，避免阻塞UI
 * 
 * @returns {void}
 */
function autoSolve() {
    // 如果游戏已结束或正在求解中，忽略请求
    if (gameOver || isSolving) return;

    // 标记正在求解
    isSolving = true;
    
    // 更新按钮状态和文本
    solveBtn.disabled = true;
    solveBtn.textContent = '求解中...';

    // 异步执行求解算法（避免阻塞UI）
    setTimeout(() => {
        // 调用求解器
        const solution = solvePuzzle();

        if (solution) {
            // 找到解决方案，开始动画演示
            solveBtn.textContent = `找到方案，${solution.length}步，演示中...`;
            animateSolution(solution);
        } else {
            // 未找到解决方案
            alert('未找到解决方案！可能需要更多迭代次数。');
            // 恢复按钮状态
            isSolving = false;
            solveBtn.disabled = false;
            solveBtn.textContent = '自动求解';
        }
    }, 50);
}

/**
 * 初始化游戏
 * 
 * 游戏启动时调用，完成以下初始化工作：
 * 1. 初始化方块布局
 * 2. 加载图片资源（图片加载完成后自动绘制棋盘）
 * 3. 添加所有事件监听器
 * 
 * @returns {void}
 */
function initGame() {
    // 设置画布尺寸
    updateCanvasSize();

    // 初始化方块布局（使用默认布局方案）
    initBlocks();
    
    // 加载人物图片资源
    // 注意：图片加载是异步的，加载完成后会自动调用 drawBoard()
    loadImages();

    // 添加键盘事件监听器
    document.addEventListener('keydown', handleKeyPress);
    
    // 添加鼠标事件监听器
    canvas.addEventListener('mousedown', handleMouseDown);  // 鼠标按下
    canvas.addEventListener('mousemove', handleMouseMove);  // 鼠标移动
    canvas.addEventListener('mouseup', handleMouseUp);      // 鼠标释放
    canvas.addEventListener('mouseleave', handleMouseUp);   // 鼠标离开画布
    
    // 添加按钮点击事件监听器
    resetBtn.addEventListener('click', resetGame);  // 重置游戏
    solveBtn.addEventListener('click', autoSolve);  // 自动求解
    
    // 添加布局选择下拉菜单的变化事件
    layoutSelect.addEventListener('change', function() {
        // 布局改变时重置游戏
        resetGame();
    });

    // 添加格子大小选择下拉菜单的变化事件
    const gridSizeSelect = document.getElementById('gridSizeSelect');
    gridSizeSelect.addEventListener('change', function() {
        gridSize = parseInt(this.value);
        updateCanvasSize();
        resetGame();
    });
}

/**
 * 更新画布尺寸
 *
 * 根据当前的格子大小重新计算并设置画布尺寸
 * 画布宽度 = 4列 * 格子大小
 * 画布高度 = 5行 * 格子大小 + 20px出口区域
 *
 * @returns {void}
 */
function updateCanvasSize() {
    canvas.width = cols * gridSize;
    canvas.height = rows * gridSize + 20;
    drawBoard();
}

// 启动游戏
initGame();