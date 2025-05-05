# 视频字幕搜索与视频片段生成系统
本项目用于加载和组织多部剧集的视频分析数据，提供字幕搜索及视频片段生成功能。

## 安装依赖

### 1. 后端依赖

```bash

# 请安装以下主要依赖
pip install flask flask-cors numpy pandas pypinyin opencv-python ffmpeg-python
```

### 2. 前端依赖

```bash
# 进入前端应用目录
cd subtitle-search-app

# 安装Node.js依赖
npm install
```

## 启动方法

### 1. 启动后端API服务

```bash
# 进入项目根目录
cd create_video

# 启动API服务（前台运行，便于查看日志）
python subtitle_api.py --port 8089
```

API服务将在 http://localhost:8089 上运行，提供以下主要端点：
- `/api/status`: 检查API状态
- `/api/search`: 搜索字幕
- `/api/generate_clip`: 生成视频片段
- `/api/random_sentences`: 获取随机字幕句子
- `/api/merge_clips`: 合并多个视频片段
- `/api/rhyming_sentences`: 获取押韵字幕
- `/api/dialogue_responses`: 获取对话回应

### 2. 启动前端应用

```bash
# 进入前端应用目录
cd subtitle-search-app

# 开发模式启动
npm start

# 或构建并使用静态服务器启动
npm run build
npx serve -s build -p 3000
```

前端应用将在 http://localhost:3000 上运行。

## 数据来源

数据源位于: `/Users/h0270/Documents/code/ai-vedio/video_search/output`
使用项目https://github.com/aipjn/vedio-understand构建数据
使用subtitle_recognizer/subtitle_ocr.py生成字幕数据

构建好的数据配置在：drama_config.py
video_root 是视频的地址
output_path 为vedio-understand 生成的字幕文件地址
episodes 为文件名字和文件序号起始
video_pattern 为视频的地址内部的情况，有几级目录，命名方法


包含内容:
- **字幕识别结果**: `subtitles/subtitle.txt`
- **人名识别结果**: `subtitles/names.txt`

## 最新优化

1. **字幕处理优化**:
   - 增强停用词过滤，添加"了"字为停用词
   - 优化字幕前缀处理，自动去除特定文本前缀
   - 改进词语匹配算法

2. **接口参数处理**:
   - 修复剧集ID参数传递问题
   - 优化API请求格式
   - 提高跨剧集搜索可靠性

3. **界面优化**:
   - 在所有句子选择区域显示剧集名称
   - 优化视频信息显示
   - 提升用户体验

## 功能特性

1. **字幕搜索**:
   - 支持精确和模糊搜索
   - 支持区分大小写选项
   - 显示匹配结果的剧集名称、集数、时间位置和字幕内容
   - 支持多剧集选择和过滤

2. **字幕接龙游戏**:
   - 从字幕库中选择适合的开始句子
   - 支持自动生成接续选项
   - 记录游戏过程并支持视频导出
   - 多剧集支持，显示剧集名称信息

## 注意事项

- 确保视频源路径可访问
- 前端和后端需要分别启动
- 大规模视频生成可能需要较长时间和足够的存储空间
- 需要安装FFmpeg以支持视频处理功能

