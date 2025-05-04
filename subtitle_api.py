import os
import json
import re
import uuid
import random
import subprocess
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from data_loader import DataLoader
from typing import List, Dict, Any, Optional
import time
import fnmatch
from drama_config import get_drama_config, get_drama_list, DEFAULT_DRAMA, get_video_root

# 拼音处理库
from pypinyin import pinyin, Style

app = Flask(__name__)
# 明确允许所有域的CORS请求
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 视频目录配置
CLIP_OUTPUT_DIR = "./video_clips"
MERGED_OUTPUT_DIR = "./merged_videos"

# 确保输出目录存在
os.makedirs(CLIP_OUTPUT_DIR, exist_ok=True)
os.makedirs(MERGED_OUTPUT_DIR, exist_ok=True)

# 初始化DataLoader - 每个剧集一个加载器
drama_loaders = {}
# 缓存所有集数数据，避免重复加载 - 每个剧集一个缓存
episode_data_cache = {}
# 存储所有字幕，用于快速搜索 - 每个剧集一个列表
all_subtitles = {}  

def init_data():
    """初始化加载所有数据"""
    global drama_loaders, episode_data_cache, all_subtitles
    
    # 获取所有剧集列表
    dramas = get_drama_list()
    
    for drama in dramas:
        drama_id = drama["id"]
        print(f"正在加载剧集 {drama['name']} ({drama_id}) 的数据...")
        
        # 为每个剧集初始化加载器
        loader = DataLoader(drama_id=drama_id)
        drama_loaders[drama_id] = loader
        
        # 初始化剧集的缓存
        episode_data_cache[drama_id] = {}
        all_subtitles[drama_id] = []
        
        # 加载剧集的所有集数
        episodes = loader.load_episode_list()
        
        for episode in episodes:
            print(f"加载 {drama['name']} - {episode} 数据...")
            episode_data = loader.load_episode_data(episode)
            episode_data_cache[drama_id][episode] = episode_data
            
            # 收集字幕
            for subtitle in episode_data["subtitles"]:
                all_subtitles[drama_id].append({
                    "drama_id": drama_id, 
                    "episode": episode,
                    "start_time": subtitle["start_time"],
                    "end_time": subtitle["end_time"],
                    "text": subtitle["text"],
                    "start_seconds": loader.timestamp_to_seconds(subtitle["start_time"]),
                    "end_seconds": loader.timestamp_to_seconds(subtitle["end_time"])
                })
        
        print(f"剧集 {drama['name']} 数据加载完成，共 {len(episodes)} 集，{len(all_subtitles[drama_id])} 条字幕")
    
    # 计算加载的总数据
    total_episodes = sum(len(episodes) for episodes in episode_data_cache.values())
    total_subtitles = sum(len(subtitles) for subtitles in all_subtitles.values())
    print(f"所有数据加载完成，共 {len(drama_loaders)} 个剧集，{total_episodes} 集，{total_subtitles} 条字幕")

def search_subtitles(query: str, drama_ids: List[str] = None, case_sensitive: bool = False, use_regex: bool = False) -> List[Dict]:
    """
    搜索包含指定文本的字幕
    
    Args:
        query: 搜索文本
        drama_ids: 要搜索的剧集ID列表，None表示所有剧集
        case_sensitive: 是否区分大小写
        use_regex: 是否使用正则表达式
        
    Returns:
        匹配的字幕列表
    """
    results = []
    
    # 确定要搜索的剧集列表
    if drama_ids is None or len(drama_ids) == 0:
        # 搜索所有剧集
        target_dramas = list(all_subtitles.keys())
    else:
        # 搜索指定剧集
        target_dramas = drama_ids
    
    # 合并所有目标剧集的字幕到一个列表中
    merged_subtitles = []
    for drama_id in target_dramas:
        merged_subtitles.extend(all_subtitles[drama_id])
    
    if use_regex:
        # 使用正则表达式搜索
        try:
            flags = 0 if case_sensitive else re.IGNORECASE
            pattern = re.compile(query, flags)
            
            for subtitle in merged_subtitles:
                if pattern.search(subtitle["text"]):
                    results.append(subtitle)
        except re.error:
            # 正则表达式错误，回退到普通搜索
            print(f"正则表达式错误: {query}，回退到普通搜索")
            return search_subtitles(query, drama_ids, case_sensitive, False)
    else:
        # 普通文本搜索
        if not case_sensitive:
            pattern = re.compile(query, re.IGNORECASE)
            
            for subtitle in merged_subtitles:
                if pattern.search(subtitle["text"]):
                    results.append(subtitle)
        else:
            for subtitle in merged_subtitles:
                if query in subtitle["text"]:
                    results.append(subtitle)
    
    # 按剧集、集数和时间排序
    results.sort(key=lambda x: (x["drama_id"], x["episode"], x["start_seconds"]))
    
    return results

def get_filtered_subtitles(drama_ids: List[str] = None, min_length: int = 3, max_length: int = 8) -> List[Dict]:
    """
    获取过滤后的字幕列表（适合接龙游戏）
    
    Args:
        drama_ids: 要获取的剧集ID列表，None表示所有剧集
        min_length: 最小字幕长度
        max_length: 最大字幕长度
        
    Returns:
        过滤后的字幕列表
    """
    filtered_subtitles = []
    
    # 确定要处理的剧集列表
    if drama_ids is None or len(drama_ids) == 0:
        target_dramas = list(all_subtitles.keys())
    else:
        target_dramas = drama_ids
    
    # 合并所有目标剧集的字幕到一个列表中
    merged_subtitles = []
    for drama_id in target_dramas:
        merged_subtitles.extend(all_subtitles[drama_id])
    
    # 移除语气词结尾
    for subtitle in merged_subtitles:
        # 去除语气词
        clean_text = re.sub(r'[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$', '', subtitle["text"])
        
        # 检查长度
        if len(clean_text) >= min_length and len(clean_text) <= max_length:
            filtered_subtitles.append(subtitle)
    
    return filtered_subtitles

def get_random_sentences(drama_ids: List[str] = None, count: int = 8) -> List[Dict]:
    """
    获取随机字幕句子（适合接龙游戏的开始提示）
    
    Args:
        drama_ids: 要获取的剧集ID列表，None表示所有剧集
        count: 返回的句子数量
        
    Returns:
        随机字幕列表
    """
    filtered_subtitles = get_filtered_subtitles(drama_ids, 3, 8)
    
    if len(filtered_subtitles) <= count:
        return filtered_subtitles
    
    # 随机选择指定数量的字幕
    return random.sample(filtered_subtitles, count)

def generate_video_clip(drama_id: str, episode: str, start_time: float, end_time: float, 
                       context_seconds: int = 2) -> str:
    """
    从原始视频中提取指定时间段的片段
    
    Args:
        drama_id: 剧集ID
        episode: 集数名称
        start_time: 开始时间（秒）
        end_time: 结束时间（秒）
        context_seconds: 上下文秒数（在开始和结束时间前后额外包含的秒数）
        
    Returns:
        生成的视频片段路径
    """
    # 获取剧集配置
    drama_config = get_drama_config(drama_id)
    
    # 调整时间范围，添加上下文
    adjusted_start = max(0, start_time - context_seconds)
    adjusted_end = end_time + context_seconds
    duration = adjusted_end - adjusted_start
    
    # 从剧集名称中提取集数
    episode_num = None
    if drama_id == "zhenhuan":
        # 甄嬛传的集数格式: 后宫·甄嬛传01
        match = re.search(r'\d+', episode)
        if match:
            episode_num = match.group()
    elif drama_id == "lurk":
        # 潜伏的集数格式: 潜 伏.Lurk.2009.E20.WEB-DL.4K.2160p.H265.AAC-DHTCLUB
        match = re.search(r'E(\d+)', episode)
        if match:
            episode_num = match.group(1)
    else:
        # 通用提取数字的方式
        match = re.search(r'\d+', episode)
        if match:
            episode_num = match.group()
    
    if episode_num is None:
        print(f"无法从剧集名称 {episode} 中提取集数")
        return None
        
    # 创建缓存目录 - 按剧集区分
    cache_dir = os.path.join(CLIP_OUTPUT_DIR, f"{drama_id}_episode_{episode_num}")
    os.makedirs(cache_dir, exist_ok=True)
    
    # 检查缓存：根据剧集、集数和时间范围查找是否已存在类似片段
    cache_pattern = f"{drama_id}_{episode_num}_{int(adjusted_start)}_{int(adjusted_end)}_*.mp4"
    
    # 在缓存目录中查找
    existing_clips = []
    for f in os.listdir(cache_dir):
        if fnmatch.fnmatch(f, cache_pattern):
            existing_clips.append(os.path.join(cache_dir, f))
    
    if existing_clips:
        # 使用已有的缓存片段
        print(f"使用缓存的视频片段: {existing_clips[0]}")
        return existing_clips[0]
    
    # 没有缓存，生成新片段
    clip_id = str(uuid.uuid4())[:8]
    output_file = os.path.join(cache_dir, f"{drama_id}_{episode_num}_{int(adjusted_start)}_{int(adjusted_end)}_{clip_id}.mp4")
    
    # 获取视频根目录
    VIDEO_ROOT = get_video_root(drama_id)
    
    # 构建视频文件路径，基于剧集的视频模式
    video_file = None
    
    # 尝试主要模式
    primary_pattern = drama_config["video_pattern"]["primary"]
    primary_path = os.path.join(VIDEO_ROOT, primary_pattern.format(episode=episode, episode_num=episode_num))
    print(f"尝试主要视频路径: {primary_path}")
    
    if os.path.exists(primary_path):
        video_file = primary_path
    else:
        # 尝试备选模式
        fallback_pattern = drama_config["video_pattern"]["fallback"]
        fallback_path = os.path.join(VIDEO_ROOT, fallback_pattern.format(episode=episode, episode_num=episode_num))
        print(f"尝试备选视频路径: {fallback_path}")
        
        if os.path.exists(fallback_path):
            video_file = fallback_path
    
    if not video_file:
        print(f"视频文件不存在，剧集: {drama_id}, 集数: {episode}")
        return None
    
    # 构建优化的ffmpeg命令 - 使用硬件加速
    start_fmt = format_time_for_ffmpeg(adjusted_start)
    
    # 检测系统是否支持硬件加速
    hardware_accel = ""
    try:
        # 检查Mac平台的VideoToolbox硬件加速是否可用
        hw_check = subprocess.run(["ffmpeg", "-hwaccels"], capture_output=True, text=True, check=False)
        if "videotoolbox" in hw_check.stdout.lower():
            hardware_accel = "videotoolbox"
            print("使用VideoToolbox硬件加速")
    except Exception as e:
        print(f"检查硬件加速出错: {e}")
    
    # 根据是否有硬件加速选择适当的命令
    if hardware_accel:
        cmd = [
            "ffmpeg", "-y",
            "-ss", start_fmt,  # 先定位到时间点再输入，提高速度
            "-i", video_file,
            "-t", str(duration),
            "-c:v", "h264_videotoolbox",  # 使用VideoToolbox硬件加速
            "-b:v", "2000k",  # 限制比特率，提高速度
            "-c:a", "aac",
            "-threads", "4",     # 使用多线程编码
            "-movflags", "+faststart",  # 优化视频流式传输
            output_file
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-ss", start_fmt,  # 先定位到时间点再输入，提高速度
            "-i", video_file,
            "-t", str(duration),
            "-c:v", "libx264", 
            "-c:a", "aac",
            "-preset", "ultrafast",
            "-tune", "fastdecode",
            "-threads", "4",     # 使用多线程编码
            "-crf", "30",        # 进一步降低画质以提高速度
            "-movflags", "+faststart",  # 优化视频流式传输
            output_file
        ]
    
    print(f"执行ffmpeg命令: {' '.join(cmd)}")
    
    # 执行命令
    try:
        subprocess.run(cmd, check=True)
        print(f"视频片段生成成功: {output_file}")
        return output_file
    except subprocess.CalledProcessError as e:
        print(f"视频片段生成失败: {e}")
        return None

def merge_video_clips(clip_urls: List[str]) -> str:
    """
    合并多个视频片段为一个视频
    
    Args:
        clip_urls: 视频片段的URL列表
        
    Returns:
        合并后的视频文件路径
    """
    # 准备临时文件列表
    temp_file_list = os.path.join(MERGED_OUTPUT_DIR, f"filelist_{uuid.uuid4()}.txt")
    
    # 获取片段文件名
    clip_files = []
    for url in clip_urls:
        # 从URL中提取文件名
        filename = os.path.basename(url)
        
        # 查找片段文件
        clip_path = None
        
        # 首先在根目录查找
        root_path = os.path.join(CLIP_OUTPUT_DIR, filename)
        if os.path.exists(root_path):
            clip_path = root_path
        else:
            # 在所有子目录中查找
            for subdir in os.listdir(CLIP_OUTPUT_DIR):
                subdir_path = os.path.join(CLIP_OUTPUT_DIR, subdir)
                if os.path.isdir(subdir_path):
                    file_path = os.path.join(subdir_path, filename)
                    if os.path.exists(file_path):
                        clip_path = file_path
                        break
        
        if clip_path:
            clip_files.append(clip_path)
        else:
            print(f"警告: 找不到视频片段 {filename}")
    
    if not clip_files:
        print("错误: 没有有效的视频片段可合并")
        return None
    
    # 创建文件列表
    with open(temp_file_list, 'w') as f:
        for clip in clip_files:
            # 使用绝对路径避免路径问题
            absolute_path = os.path.abspath(clip)
            f.write(f"file '{absolute_path}'\n")
    
    # 准备输出文件名
    output_file = os.path.join(MERGED_OUTPUT_DIR, f"merged_{uuid.uuid4()}.mp4")
    
    # 执行合并命令
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", temp_file_list,
        "-c", "copy",
        output_file
    ]
    
    print(f"执行ffmpeg合并命令: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True)
        print(f"视频合并成功: {output_file}")
        
        # 删除临时文件列表
        os.remove(temp_file_list)
        
        return output_file
    except subprocess.CalledProcessError as e:
        print(f"视频合并失败: {e}")
        
        # 尝试备选方案：逐个转码并拼接
        print("尝试备选方案: 逐个转码并拼接...")
        return merge_clips_with_transcode(clip_files)
    finally:
        # 确保临时文件被清理
        if os.path.exists(temp_file_list):
            os.remove(temp_file_list)

def merge_clips_with_transcode(clip_files: List[str]) -> str:
    """备选的视频合并方案，对每个片段进行转码再合并"""
    if not clip_files:
        return None
    
    # 准备输出文件名
    output_file = os.path.join(MERGED_OUTPUT_DIR, f"merged_{uuid.uuid4()}.mp4")
    
    # 使用临时文件存储中间结果
    temp_files = []
    temp_file_list = None
    
    try:
        # 先统一转码
        for i, clip in enumerate(clip_files):
            temp_file = os.path.join(MERGED_OUTPUT_DIR, f"temp_{i}_{uuid.uuid4()}.mp4")
            temp_files.append(temp_file)
            
            # 转码命令
            cmd = [
                "ffmpeg", "-y",
                "-i", clip,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-strict", "experimental",
                temp_file
            ]
            
            print(f"转码 {clip} -> {temp_file}")
            subprocess.run(cmd, check=True)
        
        # 创建合并文件列表
        temp_file_list = os.path.join(MERGED_OUTPUT_DIR, f"templist_{uuid.uuid4()}.txt")
        with open(temp_file_list, 'w') as f:
            for temp in temp_files:
                # 使用绝对路径避免路径嵌套问题
                absolute_path = os.path.abspath(temp)
                f.write(f"file '{absolute_path}'\n")
        
        # 合并命令
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", temp_file_list,
            "-c", "copy",
            output_file
        ]
        
        print(f"合并临时文件: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        
        print(f"备选方案视频合并成功: {output_file}")
        return output_file
    
    except subprocess.CalledProcessError as e:
        print(f"备选方案视频合并失败: {e}")
        return None
    
    finally:
        # 清理临时文件
        for temp in temp_files:
            if os.path.exists(temp):
                try:
                    os.remove(temp)
                    print(f"已清理临时文件: {temp}")
                except Exception as e:
                    print(f"清理临时文件失败 {temp}: {str(e)}")
                
        if temp_file_list and os.path.exists(temp_file_list):
            try:
                os.remove(temp_file_list)
                print(f"已清理临时文件列表: {temp_file_list}")
            except Exception as e:
                print(f"清理临时文件列表失败 {temp_file_list}: {str(e)}")

def format_time_for_ffmpeg(seconds: float) -> str:
    """将秒数转换为ffmpeg使用的时间格式 HH:MM:SS.mmm"""
    hours = int(seconds / 3600)
    minutes = int((seconds % 3600) / 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"

def get_last_char_rhyme(text):
    """获取文本最后一个字的韵母"""
    if not text:
        return None
    
    # 清理语气词
    clean_text = re.sub(r'[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$', '', text)
    if not clean_text:
        return None
    
    # 获取最后一个字
    last_char = clean_text[-1]
    
    # 获取拼音（带声调）和韵母
    try:
        char_pinyin = pinyin(last_char, style=Style.FINALS)[0][0]
        
        # 如果是空字符串，说明可能是标点符号，返回None
        if not char_pinyin:
            return None
            
        # 返回韵母（去掉声调）
        return ''.join([c for c in char_pinyin if not c.isdigit()])
    except Exception as e:
        print(f"获取韵母出错 '{last_char}': {e}")
        return None

def find_rhyming_sentences_with_scores(text, drama_ids=None, min_length=3, max_length=8, limit=20):
    """
    查找与给定文本押韵的句子，并带有相似度评分
    
    Args:
        text: 源文本
        drama_ids: 要搜索的剧集ID列表，None表示所有剧集
        min_length: 最小字符长度
        max_length: 最大字符长度
        limit: 返回结果数量限制
        
    Returns:
        按评分排序的(句子,分数)元组列表
    """
    # 获取源文本的韵母
    source_rhyme = get_last_char_rhyme(text)
    if not source_rhyme:
        return []
    
    # 确定要搜索的剧集列表
    if drama_ids is None or len(drama_ids) == 0:
        target_dramas = list(all_subtitles.keys())
    else:
        target_dramas = drama_ids
    
    # 合并所有目标剧集的字幕到一个列表中
    merged_subtitles = []
    for drama_id in target_dramas:
        merged_subtitles.extend(all_subtitles[drama_id])
    
    candidates = []
    
    # 遍历合并后的字幕列表
    for subtitle in merged_subtitles:
        subtitle_text = subtitle["text"]
        
        # 过滤长度
        if len(subtitle_text) < min_length or len(subtitle_text) > max_length:
            continue
        
        # 首先检查最后一个字是否押韵
        target_rhyme = get_last_char_rhyme(subtitle_text)
        if not target_rhyme or source_rhyme != target_rhyme:
            continue
            
        # 计算押韵分数，传递完整的文本
        score = calculate_rhyme_score(text, subtitle_text)
        if score > 0:
            candidates.append((subtitle, score))
    
    # 按分数排序
    sorted_candidates = sorted(candidates, key=lambda x: x[1], reverse=True)
    
    # 限制返回数量
    return sorted_candidates[:limit]

def find_rhyming_sentences(text, min_length=3, max_length=8, limit=20):
    """查找与给定文本押韵的句子（仅返回句子，不含分数）"""
    # 获取带分数的结果
    results_with_scores = find_rhyming_sentences_with_scores(text, None, min_length, max_length, limit)
    # 只返回句子不返回分数
    return [item[0] for item in results_with_scores]

def calculate_rhyme_score(source_text, target_text):
    """
    计算两个句子的押韵程度得分
    得分越高表示押韵效果越好
    """
    score = 10.0  # 基础分
    
    # 1. 获取干净文本（去除语气词）
    source_clean = re.sub(r'[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$', '', source_text)
    target_clean = re.sub(r'[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$', '', target_text)
    
    # 2. 长度适中加分
    if 4 <= len(target_clean) <= 6:
        score += 2.0  # 长度最合适
    elif 3 <= len(target_clean) < 4 or 6 < len(target_clean) <= 8:
        score += 1.0  # 长度尚可
    
    # 3. 检测结尾两个字是否都押韵（获取倒数第二个字的韵母）
    if len(source_clean) >= 2 and len(target_clean) >= 2:
        try:
            source_second_last = source_clean[-2]
            target_second_last = target_clean[-2]
            
            source_second_rhyme = pinyin(source_second_last, style=Style.FINALS)[0][0]
            target_second_rhyme = pinyin(target_second_last, style=Style.FINALS)[0][0]
            
            # 去掉声调
            source_second_rhyme = ''.join([c for c in source_second_rhyme if not c.isdigit()])
            target_second_rhyme = ''.join([c for c in target_second_rhyme if not c.isdigit()])
            
            if source_second_rhyme and target_second_rhyme and source_second_rhyme == target_second_rhyme:
                score += 3.0  # 倒数第二个字也押韵，更好
        except Exception:
            pass  # 忽略错误，不加倒数第二个字的分
    
    # 4. 句子长度相近更好 (长度差距越小分数越高)
    length_diff = abs(len(source_clean) - len(target_clean))
    if length_diff == 0:
        score += 2.0  # 完全相同长度
    elif length_diff == 1:
        score += 1.5  # 差1个字
    elif length_diff == 2:
        score += 1.0  # 差2个字
    
    # 5. 避免结尾是标点符号的句子
    if target_clean and target_clean[-1] in '，。！？：；""''（）【】《》、':
        score -= 2.0
    
    return score

# 按剧集ID组织的对话回应
def find_dialogue_responses(text, current_drama_id, current_episode, drama_ids=None):
    """
    基于规则的对话回应查找
    
    Args:
        text: 源句子文本
        current_drama_id: 当前剧集ID
        current_episode: 源句子所在集数
        drama_ids: 要搜索的剧集ID列表，None表示所有剧集
        
    Returns:
        按得分排序的回应句子列表
    """
    # 确保current_drama_id是有效的
    if current_drama_id not in all_subtitles:
        current_drama_id = DEFAULT_DRAMA
        
    # 确定要搜索的剧集列表
    if drama_ids is None or len(drama_ids) == 0:
        target_dramas = list(all_subtitles.keys())
    else:
        target_dramas = [drama_id for drama_id in drama_ids if drama_id in all_subtitles]
    
    # 合并所有目标剧集的字幕到一个列表中
    merged_subtitles = []
    for drama_id in target_dramas:
        merged_subtitles.extend(all_subtitles[drama_id])
        
    # 对源句子进行分析
    # 1. 问答规则: 识别问句并匹配非问句回应
    is_question = '?' in text or '？' in text or '吗' in text or '呢' in text
    
    # 2. 长度分析
    is_long = len(text) > 12
    
    # 3. 情感分析
    positive_words = ["好", "愿意", "可以", "是", "对", "喜欢", "爱", "高兴"]
    negative_words = ["不", "没", "别", "莫", "拒绝", "难过", "恨", "讨厌"]
    has_positive = any(word in text for word in positive_words)
    has_negative = any(word in text for word in negative_words)
    
    # 5. 转折检测
    transition_words = ["但", "却", "然而", "只是", "不过", "反而"]
    has_transition = any(word in text for word in transition_words)
    
    # 6. 命令句检测
    command_words = ["去", "来", "给我", "快", "立刻", "马上", "传"]
    is_command = any(word in text for word in command_words)
    
    # 7. 惊讶感叹检测
    surprise_words = ["啊", "哎呀", "天哪", "竟然", "居然", "怎么会"]
    is_surprised = any(word in text for word in surprise_words)
    
    # 评分函数
    def score_candidate(candidate_text, candidate_drama_id, candidate_episode):
        score = 0
        
        # 跳过同一集
        if candidate_drama_id == current_drama_id and candidate_episode == current_episode:
            return -1
        
        # 问答配对
        if is_question and not ('?' in candidate_text or '？' in candidate_text or '吗' in candidate_text or '呢' in candidate_text):
            score += 1.5
        
        # 长度平衡
        if (is_long and len(candidate_text) < 10) or (not is_long and len(candidate_text) < 15):
            score += 1
        
        # 情感对比
        candidate_positive = any(word in candidate_text for word in positive_words)
        candidate_negative = any(word in candidate_text for word in negative_words)
        if (has_positive and candidate_negative) or (has_negative and candidate_positive):
            score += 1.5
        
        # 转折对比
        candidate_transition = any(word in candidate_text for word in transition_words)
        if has_transition != candidate_transition:
            score += 0.5
        
        # 命令回应
        if is_command:
            comply_words = ["是", "遵命", "好的", "立刻"]
            rebel_words = ["不", "不行", "恐怕", "不能"]
            if any(word in candidate_text for word in comply_words + rebel_words):
                score += 1.5
        
        # 惊讶对比
        candidate_surprised = any(word in candidate_text for word in surprise_words)
        if is_surprised != candidate_surprised:
            score += 1
            
        return score
    
    # 筛选和评分候选项 - 从合并的字幕列表中选择
    candidates = []
    for subtitle in merged_subtitles:
        # 跳过同一集的候选
        if subtitle['drama_id'] == current_drama_id and subtitle['episode'] == current_episode:
            continue
            
        score = score_candidate(subtitle['text'], subtitle['drama_id'], subtitle['episode'])
        if score > 0:
            candidates.append((subtitle, score))
    
    # 排序候选项
    sorted_candidates = sorted(candidates, key=lambda x: x[1], reverse=True)
    
    # 选择最佳回应
    result = []
    
    # 确保有足够的高质量回应
    if len(sorted_candidates) >= 8:
        # 直接选择排名前8的回应
        result = [c[0] for c in sorted_candidates[:8]]
    else:
        # 使用所有可用的高质量回应
        result = [c[0] for c in sorted_candidates]
        
        # 如果候选数量不足，从所有字幕中随机选择一些补充
        if len(result) < 8:
            random_pool = []
            for subtitle in merged_subtitles:
                if (subtitle['drama_id'] != current_drama_id or subtitle['episode'] != current_episode) and subtitle not in result:
                    random_pool.append(subtitle)
                    
            if len(random_pool) > 0:
                needed = 8 - len(result)
                random_picks = random.sample(random_pool, min(needed, len(random_pool)))
                result.extend(random_picks)
    
    # 限制返回8个结果
    if len(result) > 8:
        result = result[:8]
    
    # 为了保持一些惊喜性，添加适度的随机性但保持高分回应排在前面
    # 前3个保持不变（最高分），后5个略微打乱
    if len(result) > 3:
        high_ranked = result[:3]
        remaining = result[3:]
        random.shuffle(remaining)
        result = high_ranked + remaining
    
    return result

# 更新对话回应API
@app.route('/api/dialogue_responses', methods=['POST'])
def dialogue_responses():
    data = request.json
    if not data:
        return jsonify({'error': '请提供句子数据'}), 400
    
    sentence_text = data.get('sentence_text', '')
    drama_id = data.get('drama_id', DEFAULT_DRAMA)
    episode = data.get('episode', '')
    drama_ids_str = data.get('drama_ids', '')
    
    if not sentence_text:
        return jsonify({'error': '缺少句子文本'}), 400
    
    # 处理剧集ID列表
    drama_ids = None
    if drama_ids_str:
        if isinstance(drama_ids_str, str):
            drama_ids = drama_ids_str.split(',')
        elif isinstance(drama_ids_str, list):
            drama_ids = drama_ids_str
    
    # 查找合适的对话回应，按得分排序后返回
    responses = find_dialogue_responses(sentence_text, drama_id, episode, drama_ids)
    
    return jsonify({
        'results': responses,
        'count': len(responses)
    })

# API搜索端点
@app.route('/api/search', methods=['GET'])
def api_search():
    query = request.args.get('query', '')
    drama_ids_str = request.args.get('drama_ids', '')
    case_sensitive = request.args.get('case_sensitive', 'false').lower() == 'true'
    use_regex = request.args.get('regex', 'false').lower() == 'true'
    
    if not query:
        return jsonify({'error': '请提供搜索查询'}), 400
    
    # 处理剧集ID列表
    drama_ids = None
    if drama_ids_str:
        drama_ids = drama_ids_str.split(',')
    
    results = search_subtitles(query, drama_ids, case_sensitive, use_regex)
    
    return jsonify({
        'results': results,
        'count': len(results),
        'query': query
    })

# 获取随机句子端点
@app.route('/api/random_sentences', methods=['GET'])
def api_random_sentences():
    count = request.args.get('count', '8')
    try:
        count = int(count)
    except ValueError:
        count = 8
    
    drama_ids_str = request.args.get('drama_ids', '')
    drama_ids = None
    if drama_ids_str:
        drama_ids = drama_ids_str.split(',')
    
    sentences = get_random_sentences(drama_ids, count)
    
    return jsonify({
        'results': sentences,
        'count': len(sentences)
    })

# 生成视频片段端点
@app.route('/api/generate_clip', methods=['POST'])
def api_generate_clip():
    data = request.json
    if not data:
        return jsonify({'error': '请提供片段数据'}), 400
    
    drama_id = data.get('drama_id', DEFAULT_DRAMA)
    episode = data.get('episode', '')
    start_time = data.get('start_time', 0)
    end_time = data.get('end_time', 0)
    context_seconds = data.get('context_seconds', 2)
    
    if not episode or start_time is None or end_time is None:
        return jsonify({'error': '缺少必要参数'}), 400
    
    # 将时间转换为浮点数
    try:
        start_time = float(start_time)
        end_time = float(end_time)
        context_seconds = int(context_seconds)
    except ValueError:
        return jsonify({'error': '时间格式无效'}), 400
    
    # 生成视频片段
    clip_path = generate_video_clip(drama_id, episode, start_time, end_time, context_seconds)
    
    if not clip_path:
        return jsonify({'error': '视频片段生成失败'}), 500
    
    # 构建视频URL
    filename = os.path.basename(clip_path)
    clip_url = f"/api/clips/{filename}"
    
    return jsonify({
        'clip_url': clip_url,
        'filename': filename,
        'drama_id': drama_id,
        'episode': episode,
        'start_time': start_time,
        'end_time': end_time,
        'duration': end_time - start_time + (context_seconds * 2)
    })

# 获取可用剧集列表端点
@app.route('/api/dramas', methods=['GET'])
def api_dramas():
    """返回所有可用的剧集列表"""
    dramas = get_drama_list()
    return jsonify({
        'dramas': dramas,
        'count': len(dramas)
    })

# 获取API状态端点
@app.route('/api/status', methods=['GET'])
def api_status():
    """返回API服务状态和基本信息"""
    drama_stats = {}
    for drama_id in all_subtitles:
        drama_stats[drama_id] = {
            'episode_count': len(episode_data_cache.get(drama_id, {})),
            'subtitle_count': len(all_subtitles.get(drama_id, []))
        }
        
    return jsonify({
        'status': 'ok',
        'dramas': get_drama_list(),
        'drama_stats': drama_stats,
        'total_episodes': sum(stats['episode_count'] for stats in drama_stats.values()),
        'total_subtitles': sum(stats['subtitle_count'] for stats in drama_stats.values())
    })

# 合并视频片段端点
@app.route('/api/merge_clips', methods=['POST'])
def api_merge_clips():
    data = request.json
    if not data:
        return jsonify({'error': '请提供片段数据'}), 400
    
    clip_urls = data.get('clip_urls', [])
    
    if not clip_urls or len(clip_urls) < 2:
        return jsonify({'error': '至少需要两个视频片段URL'}), 400
    
    # 合并视频片段
    merged_path = merge_video_clips(clip_urls)
    
    if not merged_path:
        return jsonify({'error': '视频片段合并失败'}), 500
    
    # 构建视频URL
    filename = os.path.basename(merged_path)
    merged_url = f"/api/merged/{filename}"
    
    return jsonify({
        'merged_url': merged_url,
        'filename': filename
    })

# 视频片段服务端点
@app.route('/api/clips/<filename>', methods=['GET'])
@app.route('/clips/<filename>', methods=['GET'])
def serve_clip(filename):
    """提供视频片段文件"""
    # 首先在根目录查找
    if os.path.exists(os.path.join(CLIP_OUTPUT_DIR, filename)):
        return send_file(os.path.join(CLIP_OUTPUT_DIR, filename), mimetype='video/mp4')
    
    # 在各剧集子目录中查找
    for subdir in os.listdir(CLIP_OUTPUT_DIR):
        subdir_path = os.path.join(CLIP_OUTPUT_DIR, subdir)
        if os.path.isdir(subdir_path):
            file_path = os.path.join(subdir_path, filename)
            if os.path.exists(file_path):
                return send_file(file_path, mimetype='video/mp4')
    
    return jsonify({'error': '视频片段不存在'}), 404

# 合并视频服务端点
@app.route('/api/merged/<filename>', methods=['GET'])
@app.route('/merged/<filename>', methods=['GET'])
def serve_merged(filename):
    """提供合并后的视频文件"""
    filepath = os.path.join(MERGED_OUTPUT_DIR, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': '合并视频不存在'}), 404
    
    # 设置Content-Disposition头部，强制浏览器下载文件而不是预览
    response = send_file(filepath, mimetype='video/mp4')
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response

# 健康检查端点
@app.route('/health', methods=['GET'])
def health_check():
    """简单的健康检查"""
    return "OK", 200

# 韵脚查找API端点 
@app.route('/api/rhyming_sentences', methods=['GET'])
def api_rhyming_sentences():
    """查找押韵句子API"""
    text = request.args.get('text', '')
    drama_ids_str = request.args.get('drama_ids', '')
    min_length = request.args.get('min_length', '3')
    max_length = request.args.get('max_length', '8')
    limit = request.args.get('limit', '20')
    
    if not text:
        return jsonify({"error": "缺少文本参数"}), 400
    
    # 处理剧集ID列表
    drama_ids = None
    if drama_ids_str:
        drama_ids = drama_ids_str.split(',')
    
    try:
        min_length = int(min_length)
        max_length = int(max_length)
        limit = int(limit)
    except ValueError:
        return jsonify({"error": "长度或数量参数格式错误"}), 400
    
    try:
        # 获取该文本的韵母
        rhyme = get_last_char_rhyme(text)
        
        if not rhyme:
            return jsonify({
                "source_text": text,
                "rhyme": None,
                "error": "无法获取文本的韵母",
                "count": 0,
                "results": []
            })
        
        # 查找押韵句子(获取带分数的结果，按分数排序)
        results_with_scores = find_rhyming_sentences_with_scores(text, drama_ids, min_length, max_length, limit)
        
        # 只提取句子部分，不包含分数
        sentences = [item[0] for item in results_with_scores]
        
        return jsonify({
            "source_text": text,
            "rhyme": rhyme,
            "count": len(sentences),
            "results": sentences
        })
    except Exception as e:
        print(f"查找押韵句子出错: {str(e)}")
        return jsonify({"error": f"查找押韵句子出错: {str(e)}"}), 500

if __name__ == '__main__':
    # 添加命令行参数支持
    import argparse
    
    parser = argparse.ArgumentParser(description='启动字幕搜索API服务')
    parser.add_argument('--port', type=int, default=5000, help='API服务端口号')
    args = parser.parse_args()
    
    # 初始化数据
    init_data()
    
    # 启动API服务
    app.run(host='0.0.0.0', port=args.port, debug=True)