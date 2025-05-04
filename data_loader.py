import os
import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from drama_config import get_drama_config, DEFAULT_DRAMA

class DataLoader:
    def __init__(self, drama_id: str = DEFAULT_DRAMA, base_path: str = None):
        # 获取剧集配置
        self.drama_config = get_drama_config(drama_id)
        self.drama_id = drama_id
        
        # 如果没有提供base_path，则使用剧集配置中的输出路径
        self.base_path = Path(base_path if base_path else self.drama_config["output_path"])
        self.episodes = []
        self.data = {}
        
    def load_episode_list(self, start_ep: int = None, end_ep: int = None):
        """Load list of available episodes in the specified range"""
        self.episodes = []
        
        # 使用剧集配置中的起始和结束集数（如果未指定）
        if start_ep is None:
            start_ep = self.drama_config["episodes"]["start"]
        if end_ep is None:
            end_ep = self.drama_config["episodes"]["end"]
            
        # 获取剧集名称模式
        episode_pattern = self.drama_config["episodes"]["pattern"]
        
        for i in range(start_ep, end_ep + 1):
            # 使用配置中的模式格式化剧集名称
            ep_name = episode_pattern.format(episode=i, episode_num=i)
            ep_path = self.base_path / ep_name
            if ep_path.exists():
                self.episodes.append(ep_name)
        
        return self.episodes
    
    def load_subtitle_data(self, episode: str) -> Dict:
        """Load subtitle data for a specific episode"""
        subtitle_path = self.base_path / episode / "subtitles" / "subtitle.txt"
        names_path = self.base_path / episode / "subtitles" / "names.txt"
        
        data = {"subtitle": None, "names": None}
        
        # Load subtitle.txt
        if subtitle_path.exists():
            with open(subtitle_path, "r", encoding="utf-8") as f:
                data["subtitle"] = f.read()
        
        # Load names.txt
        if names_path.exists():
            with open(names_path, "r", encoding="utf-8") as f:
                data["names"] = f.read()
        
        return data
    
    def clean_timestamp(self, timestamp: str) -> str:
        """Clean and standardize timestamp format"""
        # Remove non-digit, non-colon characters, keeping only digits, colons, and periods
        cleaned = re.sub(r'[^\d:.]', '', timestamp)
        
        # Handle edge cases like incomplete timestamps
        if cleaned.count(':') == 1:
            # If there's only one ':', it's likely a MM:SS format
            if cleaned.startswith(':'):
                cleaned = '0' + cleaned  # Add a leading zero
            elif cleaned.endswith(':'):
                cleaned = cleaned + '00'  # Add trailing zeros
        
        return cleaned
    
    def parse_subtitle_data(self, subtitle_text: str) -> List[Dict]:
        """Parse subtitle data from subtitle.txt"""
        if not subtitle_text:
            return []
        
        subtitle_entries = []
        lines = subtitle_text.split('\n')
        
        # Skip header lines
        start_line = 0
        for i, line in enumerate(lines):
            if line.strip().startswith("[") and " - " in line and "]" in line:
                start_line = i
                break
        
        for i in range(start_line, len(lines)):
            line = lines[i].strip()
            if not line or not line.startswith("["):
                continue
                
            # Extract timestamp and text using regex pattern
            match = re.match(r'\[(.*?) - (.*?)\] (.*)', line)
            if match:
                start_time, end_time, text = match.groups()
                
                # 处理潜伏字幕特殊情况：去掉开头的"第 "和"羊 "
                if text.startswith("第 "):
                    text = text[2:]
                elif text.startswith("羊 "):
                    text = text[2:]
                
                subtitle_entries.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "text": text
                })
        
        return subtitle_entries
    
    def is_valid_timestamp(self, timestamp: str) -> bool:
        """Check if a string is a valid timestamp format"""
        if not timestamp:
            return False
        
        # Skip metadata markers
        if timestamp in ['#', '@', '-', '*']:
            return False
            
        # Check if it has digits
        if not any(c.isdigit() for c in timestamp):
            return False
            
        # Check if it's a time format (contains : or . for seconds)
        if ':' in timestamp:
            return True
            
        # Check if it's a number (could be seconds or frame number)
        try:
            float(timestamp)
            return True
        except ValueError:
            return False
        
        return False
    
    def parse_names_data(self, names_text: str) -> List[Dict]:
        """Parse names data from names.txt"""
        if not names_text:
            return []
        
        name_entries = []
        lines = names_text.split('\n')
        
        # Skip header lines
        start_line = 0
        for i, line in enumerate(lines):
            if line.strip().startswith("[") and " - " in line and "]" in line:
                start_line = i
                break
        
        for i in range(start_line, len(lines)):
            line = lines[i].strip()
            if not line or not line.startswith("["):
                continue
                
            # Extract timestamp and name using regex pattern
            match = re.match(r'\[(.*?) - (.*?)\] (.*)', line)
            if match:
                start_time, end_time, name = match.groups()
                
                # Clean timestamps
                clean_start = self.clean_timestamp(start_time)
                clean_end = self.clean_timestamp(end_time)
                
                # Check if timestamps are valid
                is_valid_start = self.is_valid_timestamp(clean_start)
                is_valid_end = self.is_valid_timestamp(clean_end)
                
                name_entries.append({
                    "start_time": clean_start,
                    "end_time": clean_end,
                    "name": name,
                    "is_valid": is_valid_start and is_valid_end
                })
        
        return name_entries
    
    def load_episode_data(self, episode: str) -> Dict:
        """Load and parse subtitle data for a specific episode"""
        subtitle_data = self.load_subtitle_data(episode)
        
        # Parse text data into structured format
        parsed_data = {
            "subtitles": self.parse_subtitle_data(subtitle_data["subtitle"]),
            "names": self.parse_names_data(subtitle_data["names"])
        }
        
        return parsed_data
    
    def load_all_episodes(self, start_ep: int = None, end_ep: int = None):
        """Load subtitle data for all episodes in the specified range"""
        # 使用剧集配置中的起始和结束集数（如果未指定）
        if start_ep is None:
            start_ep = self.drama_config["episodes"]["start"]
        if end_ep is None:
            end_ep = self.drama_config["episodes"]["end"]
            
        episodes = self.load_episode_list(start_ep, end_ep)
        for episode in episodes:
            self.data[episode] = self.load_episode_data(episode)
            
        return self.data
    
    def timestamp_to_seconds(self, ts: str) -> float:
        """Convert timestamp string to seconds"""
        if not ts or not self.is_valid_timestamp(ts):
            return 0
        
        # Clean the timestamp to ensure it's in a standard format
        cleaned_ts = self.clean_timestamp(ts)
        if not cleaned_ts:
            return 0
            
        # Parse timestamp based on format
        parts = cleaned_ts.split(':')
        try:
            if len(parts) == 3:  # HH:MM:SS
                h, m, s = parts
                return int(h) * 3600 + int(m) * 60 + float(s)
            elif len(parts) == 2:  # MM:SS
                m, s = parts
                return int(m) * 60 + float(s)
            elif len(parts) == 1:  # SS
                return float(parts[0])
            else:
                return 0
        except (ValueError, IndexError):
            return 0
    
    def organize_timeline(self, episode: str) -> List[Dict]:
        """
        Organize subtitle and name data chronologically for an episode
        Returns a timeline where each entry contains the timestamp and all relevant data
        """
        if episode not in self.data:
            self.data[episode] = self.load_episode_data(episode)
            
        episode_data = self.data[episode]
        timeline = []
        
        # Process subtitle data
        for subtitle in episode_data["subtitles"]:
            start_seconds = self.timestamp_to_seconds(subtitle["start_time"])
            end_seconds = self.timestamp_to_seconds(subtitle["end_time"])
            
            timeline.append({
                "timestamp": subtitle["start_time"],
                "seconds": start_seconds,
                "type": "subtitle_start",
                "data": subtitle
            })
            
            timeline.append({
                "timestamp": subtitle["end_time"],
                "seconds": end_seconds,
                "type": "subtitle_end",
                "data": subtitle
            })
        
        # Process name data - only include valid timestamps
        for name_entry in episode_data["names"]:
            if name_entry["is_valid"]:
                start_seconds = self.timestamp_to_seconds(name_entry["start_time"])
                end_seconds = self.timestamp_to_seconds(name_entry["end_time"])
                
                timeline.append({
                    "timestamp": name_entry["start_time"],
                    "seconds": start_seconds,
                    "type": "name_start",
                    "data": name_entry
                })
                
                timeline.append({
                    "timestamp": name_entry["end_time"],
                    "seconds": end_seconds,
                    "type": "name_end",
                    "data": name_entry
                })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x["seconds"])
        
        return timeline


def test_data_loader():
    """Test the DataLoader functionality and show sample data from each type"""
    # Initialize data loader
    loader = DataLoader()
    
    # Load episodes list
    episodes = loader.load_episode_list(1, 63)
    print(f"Found {len(episodes)} episodes: {', '.join(episodes[:5])}...")
    
    if not episodes:
        print("No episodes found!")
        return
    
    # Select first episode for testing
    test_episode = episodes[0]
    print(f"\nTesting with episode: {test_episode}")
    
    # Load episode data
    data = loader.load_episode_data(test_episode)
    
    # Print summary
    print("\n=== Data Summary ===")
    print(f"Subtitles: {len(data['subtitles'])} entries")
    print(f"Names: {len(data['names'])} entries")
    
    # Count valid timestamped names
    valid_names = sum(1 for name in data['names'] if name.get('is_valid', False))
    print(f"Names with valid timestamps: {valid_names}")
    
    # Print sample data
    print("\n=== Sample Data ===")
    
    # Sample subtitle data
    if data['subtitles']:
        print("\nSample Subtitle Entry:")
        print(json.dumps(data['subtitles'][0], indent=2, ensure_ascii=False))
    
    # Sample names data
    if data['names']:
        print("\nSample Name Entry:")
        print(json.dumps(data['names'][0], indent=2, ensure_ascii=False))
        
        # Also show first valid timestamped name if exists
        valid_names = [name for name in data['names'] if name.get('is_valid', False)]
        if valid_names:
            print("\nSample Valid Name Entry:")
            print(json.dumps(valid_names[0], indent=2, ensure_ascii=False))
    
    # Test timeline organization
    timeline = loader.organize_timeline(test_episode)
    print(f"\n=== Timeline ===")
    print(f"Total events: {len(timeline)}")
    
    # Count event types
    event_types = {}
    for event in timeline:
        event_type = event.get('type', 'unknown')
        event_types[event_type] = event_types.get(event_type, 0) + 1
    
    print("\nEvent types:")
    for event_type, count in event_types.items():
        print(f"- {event_type}: {count} events")
    
    # Print first 3 timeline events
    print("\nFirst 3 timeline events:")
    for i, event in enumerate(timeline[:3]):
        print(f"{i+1}. [{event['timestamp']}] Type: {event['type']}")
        
        if event['type'] == 'subtitle_start' or event['type'] == 'subtitle_end':
            print(f"   Text: {event['data']['text'][:50]}...")
        elif event['type'] == 'name_start' or event['type'] == 'name_end':
            print(f"   Name: {event['data']['name']}")

if __name__ == "__main__":
    test_data_loader()
