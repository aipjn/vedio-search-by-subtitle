"""
drama_config.py - 剧集配置文件
管理多个剧集的路径配置和相关设置
"""

# 剧集配置
DRAMAS = {
    "zhenhuan": {
        "id": "zhenhuan",
        "name": "甄嬛传",
        "video_root": "/Volumes/D_Love/影视剧/甄嬛传",
        "output_path": "/Users/h0270/Documents/code/ai-vedio/video_search/output",
        "episodes": {
            "start": 1,
            "end": 76,
            "pattern": "后宫·甄嬛传{episode:02d}"
        },
        "video_pattern": {
            "primary": "{episode}.mp4/{episode}.mp4",
            "fallback": "甄嬛传_{episode_num}.mp4/甄嬛传_{episode_num}.mp4"
        },
    },
    "lurk": {
        "id": "lurk",
        "name": "潜伏",
        "video_root": "/Volumes/D_Love/影视剧/潜伏.Lurk.2009.WEB-DL.4K.2160p.H265.AAC-DHTCLUB",
        "output_path": "/Users/h0270/Documents/code/ai-vedio/video_search/output",
        "episodes": {
            "start": 1,
            "end": 30,
            "pattern": "潜伏.Lurk.2009.E{episode:02d}.WEB-DL.4K.2160p.H265.AAC-DHTCLUB"
        },
        "video_pattern": {
            "primary": "潜伏.Lurk.2009.E{episode_num}.WEB-DL.4K.2160p.H265.AAC-DHTCLUB.mp4",
            "fallback": "潜伏.Lurk.2009.E{episode_num:02d}.WEB-DL.4K.2160p.H265.AAC-DHTCLUB.mp4"
        },
    }
}

# 默认剧集ID
DEFAULT_DRAMA = "zhenhuan"

# 获取所有剧集列表（用于前端显示）
def get_drama_list():
    """返回所有剧集的基本信息列表"""
    return [
        {
            "id": drama["id"],
            "name": drama["name"],
            "episodes": {
                "start": drama["episodes"]["start"],
                "end": drama["episodes"]["end"]
            }
        }
        for drama_id, drama in DRAMAS.items()
    ]

# 获取剧集配置
def get_drama_config(drama_id):
    """根据剧集ID获取完整配置"""
    return DRAMAS.get(drama_id, DRAMAS[DEFAULT_DRAMA])

# 获取剧集视频根目录
def get_video_root(drama_id):
    """获取剧集的视频根目录"""
    drama = DRAMAS.get(drama_id, DRAMAS[DEFAULT_DRAMA])
    return drama["video_root"]

# 获取剧集输出路径
def get_output_path(drama_id):
    """获取剧集的输出目录"""
    drama = DRAMAS.get(drama_id, DRAMAS[DEFAULT_DRAMA])
    return drama["output_path"] 