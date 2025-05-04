import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

// 子页面组件
const SearchPage = ({ 
  API_BASE_URL, 
  query, 
  setQuery, 
  searchResults,
  setSearchResults,
  loading,
  setLoading,
  apiStatus,
  error,
  setError,
  selectedResult,
  setSelectedResult,
  videoUrl,
  setVideoUrl,
  isVideoLoading,
  setIsVideoLoading,
  handleSearch,
  handleGenerateClip,
  formatTime,
  formatEpisode,
  highlightText,
  availableDramas,
  selectedDramas,
  setSelectedDramas,
  formatDramaName
}) => {
  // 处理剧集选择变化
  const handleDramaChange = (dramaId) => {
    if (selectedDramas.includes(dramaId)) {
      // 如果已经选中，则从数组中移除
      setSelectedDramas(selectedDramas.filter(id => id !== dramaId));
    } else {
      // 如果未选中，则添加到数组
      setSelectedDramas([...selectedDramas, dramaId]);
    }
  };

  // 选择/取消选择所有剧集
  const toggleAllDramas = () => {
    if (selectedDramas.length === availableDramas.length) {
      // 如果已选择所有剧集，则取消选择所有
      setSelectedDramas([]);
    } else {
      // 选择所有剧集
      setSelectedDramas(availableDramas.map(drama => drama.id));
    }
  };

  return (
    <>
      <section className="search-area">
        <form onSubmit={handleSearch}>
          <div className="drama-selector">
            <div className="drama-selector-header">
              <h3>选择剧集</h3>
              <button 
                type="button" 
                className="toggle-all-button"
                onClick={toggleAllDramas}
              >
                {selectedDramas.length === availableDramas.length ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="drama-checkbox-container">
              {availableDramas.map(drama => (
                <div className="drama-checkbox" key={drama.id}>
                  <input
                    type="checkbox"
                    id={`drama-${drama.id}`}
                    checked={selectedDramas.includes(drama.id)}
                    onChange={() => handleDramaChange(drama.id)}
                  />
                  <label htmlFor={`drama-${drama.id}`}>
                    {formatDramaName(drama)}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="search-box">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入要搜索的字幕内容..."
              disabled={apiStatus !== 'connected'}
            />
            <button 
              type="submit" 
              disabled={loading || apiStatus !== 'connected' || selectedDramas.length === 0}
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}
      </section>

      <div className="content-area">
        <section className="results-area">
          <h2>搜索结果 {searchResults.length > 0 && `(${searchResults.length})`}</h2>
          
          {loading ? (
            <div className="loading">搜索中，请稍候...</div>
          ) : (
            <ul className="results-list">
              {searchResults.map((result, index) => (
                <li 
                  key={index} 
                  className={selectedResult === result ? 'selected' : ''}
                  onClick={() => handleGenerateClip(result)}
                >
                  <div className="result-header">
                    <span className="drama-name">{formatDramaName({id: result.drama_id})}</span>
                    <span className="episode">{formatEpisode(result.episode)}</span>
                    <span className="time">{formatTime(result.start_seconds)} - {formatTime(result.end_seconds)}</span>
                  </div>
                  <div 
                    className="subtitle-text"
                    dangerouslySetInnerHTML={{__html: highlightText(result.text, query)}}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="video-area">
          <h2>视频播放</h2>
          {selectedResult ? (
            <div className="video-player">
              <div className="video-info">
                <p><strong>剧集:</strong> {formatDramaName({id: selectedResult.drama_id})}</p>
                <p><strong>集数:</strong> {formatEpisode(selectedResult.episode)}</p>
                <p><strong>时间段:</strong> {formatTime(selectedResult.start_seconds)} - {formatTime(selectedResult.end_seconds)}</p>
                <p><strong>字幕内容:</strong> {selectedResult.text}</p>
              </div>
              
              {isVideoLoading ? (
                <div className="loading-video">生成视频片段中，请稍候...</div>
              ) : videoUrl ? (
                <video 
                  controls 
                  autoPlay 
                  className="video-element"
                  src={videoUrl}
                />
              ) : (
                <div className="video-placeholder">
                  {selectedResult ? '准备生成视频片段...' : '请从左侧选择一个搜索结果'}
                </div>
              )}
            </div>
          ) : (
            <div className="video-placeholder">
              请从左侧选择一个搜索结果
            </div>
          )}
        </section>
      </div>
    </>
  );
};

// 成语接龙游戏组件
const ChainGamePage = ({ 
  API_BASE_URL, 
  apiStatus,
  formatTime,
  formatEpisode,
  availableDramas,
  formatDramaName
}) => {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentPrompts, setCurrentPrompts] = useState([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [currentSentence, setCurrentSentence] = useState(null);
  const [nextOptions, setNextOptions] = useState([]);
  const [loadingNextOptions, setLoadingNextOptions] = useState(false);
  const [gameError, setGameError] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [clipUrls, setClipUrls] = useState([]);
  const [isConfirmMode, setIsConfirmMode] = useState(false);
  const [selectedDramas, setSelectedDramas] = useState(
    availableDramas ? availableDramas.map(drama => drama.id) : []
  );

  // 处理剧集选择变化
  const handleDramaChange = (dramaId) => {
    if (selectedDramas.includes(dramaId)) {
      // 如果已经选中，则从数组中移除
      setSelectedDramas(selectedDramas.filter(id => id !== dramaId));
    } else {
      // 如果未选中，则添加到数组
      setSelectedDramas([...selectedDramas, dramaId]);
    }
  };

  // 选择/取消选择所有剧集
  const toggleAllDramas = () => {
    if (selectedDramas.length === availableDramas.length) {
      // 如果已选择所有剧集，则取消选择所有
      setSelectedDramas([]);
    } else {
      // 选择所有剧集
      setSelectedDramas(availableDramas.map(drama => drama.id));
    }
  };

  // 获取随机提示句子
  const fetchRandomPrompts = async () => {
    if (selectedDramas.length === 0) {
      setGameError('请至少选择一个剧集');
      return;
    }
    
    setLoadingPrompts(true);
    setGameError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/random_sentences`, {
        params: {
          count: 8,
          drama_ids: selectedDramas.join(',')
        }
      });
      
      if (response.data && response.data.results) {
        setCurrentPrompts(response.data.results);
      } else {
        setGameError('获取随机句子失败');
      }
    } catch (error) {
      console.error('获取随机句子错误:', error);
      setGameError('无法获取随机句子');
    } finally {
      setLoadingPrompts(false);
    }
  };

  // 刷新随机提示
  const refreshRandomPrompts = () => {
    if (apiStatus === 'connected' && !loadingPrompts) {
      fetchRandomPrompts();
    }
  };

  // 生成视频片段
  const generateVideoClip = async (subtitle) => {
    setIsVideoLoading(true);
    setVideoUrl('');
    setGameError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate_clip`, {
        drama_id: subtitle.drama_id,
        episode: subtitle.episode,
        start_time: subtitle.start_seconds,
        end_time: subtitle.end_seconds,
        context_seconds: 2
      });

      if (response.data && response.data.clip_url) {
        const clipUrl = `${API_BASE_URL}${response.data.clip_url}`;
        setVideoUrl(clipUrl);
        return clipUrl;
      } else {
        setGameError('生成视频片段失败');
        return null;
      }
    } catch (error) {
      console.error('生成视频片段出错:', error);
      setGameError('视频服务出现错误，请确保视频文件存在且可访问');
      return null;
    } finally {
      setIsVideoLoading(false);
    }
  };

  // 选择开始句子
  const selectStartSentence = (prompt) => {
    setSelectedOption(prompt);
    setIsConfirmMode(true);
    generateVideoClip(prompt);
  };

  // 确认选择开始句子
  const confirmStartSentence = () => {
    const sentence = selectedOption;
    if (!sentence) return;
    
    setCurrentSentence(sentence);
    setGameLog([{...sentence, step: 1, clipUrl: videoUrl}]);
    setClipUrls([...clipUrls, videoUrl]);
    setGameStarted(true);
    fetchNextOptions(sentence.text);
    setIsConfirmMode(false);
    setSelectedOption(null);
  };

  // 取消选择
  const cancelSelection = () => {
    setIsConfirmMode(false);
    setSelectedOption(null);
    setVideoUrl('');
  };
  
  // 选择下一个句子
  const selectNextSentence = (option) => {
    setSelectedOption(option);
    setIsConfirmMode(true);
    generateVideoClip(option);
  };

  // 确认选择下一个句子
  const confirmNextSentence = () => {
    const sentence = selectedOption;
    if (!sentence) return;
    
    setCurrentSentence(sentence);
    setGameLog([...gameLog, {...sentence, step: gameLog.length + 1, clipUrl: videoUrl}]);
    setClipUrls([...clipUrls, videoUrl]);
    fetchNextOptions(sentence.text);
    setIsConfirmMode(false);
    setSelectedOption(null);
  };

  // 获取下一步选项
  const fetchNextOptions = async (text) => {
    if (!text) return;
    
    setLoadingNextOptions(true);
    setGameError(null);
    
    try {
      // 获取最后一个字，排除语气词
      let lastChar = getLastValidChar(text);
      
      if (!lastChar) {
        setGameError('无法识别有效的结尾字符');
        setLoadingNextOptions(false);
        return;
      }
      
      console.log(`正在查找以"${lastChar}"开头的句子...`);
      
      // 确保有选择的剧集
      if (selectedDramas.length === 0) {
        setGameError('请至少选择一个剧集');
        setLoadingNextOptions(false);
        return;
      }
      
      const dramaIdsParam = selectedDramas.join(',');
      const response = await fetch(`${API_BASE_URL}/api/search?query=${encodeURIComponent(`^${lastChar}`)}&use_regex=true&drama_ids=${dramaIdsParam}`);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.results) {
        console.log(`API返回了 ${data.results.length} 条结果`);
        
        // 过滤结果，保留3-8个字的句子
        const filteredResults = data.results.filter(item => {
          const cleanText = item.text.replace(/[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$/, '');
          return cleanText.length >= 3 && cleanText.length <= 8;
        });
        
        console.log(`过滤后还有 ${filteredResults.length} 条结果`);
        
        if (filteredResults.length === 0) {
          // 如果没有找到结果，尝试不使用正则表达式的精确查询
          console.log(`尝试使用精确查询搜索以"${lastChar}"开头的句子`);
          const fallbackResponse = await fetch(`${API_BASE_URL}/api/search?query=${encodeURIComponent(lastChar)}&drama_ids=${dramaIdsParam}`);
          const fallbackData = await fallbackResponse.json();
          
          if (fallbackData && fallbackData.results) {
            console.log(`精确查询返回了 ${fallbackData.results.length} 条结果`);
            // 手动过滤以lastChar开头的结果
            const manualFilteredResults = fallbackData.results.filter(item => {
              return item.text.startsWith(lastChar) && 
                     item.text.length >= 3 && 
                     item.text.length <= 8;
            });
            
            if (manualFilteredResults.length > 0) {
              console.log(`手动过滤后找到 ${manualFilteredResults.length} 条结果`);
              // 随机选择最多8个结果
              const shuffled = [...manualFilteredResults].sort(() => 0.5 - Math.random());
              setNextOptions(shuffled.slice(0, 8));
              setLoadingNextOptions(false);
              return;
            }
          }
          
          setGameError(`没有找到以"${lastChar}"开头的句子`);
        } else {
          // 随机选择最多8个结果
          const shuffled = [...filteredResults].sort(() => 0.5 - Math.random());
          setNextOptions(shuffled.slice(0, 8));
        }
      } else {
        setGameError('获取接续句子失败');
      }
    } catch (error) {
      console.error('获取接续句子错误:', error);
      setGameError(`查询错误: ${error.message}`);
    } finally {
      setLoadingNextOptions(false);
    }
  };

  // 获取最后一个有效字符（排除语气词）
  const getLastValidChar = (text) => {
    if (!text || text.length === 0) return null;
    
    // 排除常见语气词
    const cleanText = text.replace(/[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$/, '');
    return cleanText.length > 0 ? cleanText[cleanText.length - 1] : null;
  };

  // 刷新下一步选项
  const refreshNextOptions = () => {
    if (currentSentence && !loadingNextOptions) {
      fetchNextOptions(currentSentence.text);
    }
  };

  // 回到上一步
  const goBackOneStep = () => {
    if (gameLog.length <= 1) {
      // 只有一步，回到选择开始句子
      setGameStarted(false);
      setGameLog([]);
      setCurrentSentence(null);
      setNextOptions([]);
      setClipUrls([]);
      setVideoUrl('');
      fetchRandomPrompts();
    } else {
      // 移除最后一步
      const newLog = [...gameLog];
      newLog.pop();
      setGameLog(newLog);
      
      // 更新当前句子和视频
      const prevSentence = newLog[newLog.length - 1];
      setCurrentSentence(prevSentence);
      
      // 更新剪辑URL列表
      const newClipUrls = [...clipUrls];
      newClipUrls.pop();
      setClipUrls(newClipUrls);
      
      // 重新获取选项
      fetchNextOptions(prevSentence.text);
    }
  };

  // 合并视频并导出
  const exportMergedVideo = async () => {
    if (clipUrls.length === 0) return;
    
    setIsExportingVideo(true);
    setGameError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/merge_clips`, {
        clip_urls: clipUrls
      });
      
      if (response.data && response.data.merged_url) {
        const mergedVideoUrl = `${API_BASE_URL}${response.data.merged_url}`;
        
        // 创建下载链接并强制触发下载
        const link = document.createElement('a');
        link.href = mergedVideoUrl;
        link.download = '接龙视频.mp4';
        link.target = '_blank';
        document.body.appendChild(link); // 必须添加到DOM中
        link.click();
        setTimeout(() => {
          document.body.removeChild(link); // 清理DOM
        }, 100);
        
        console.log('视频合并成功，已触发下载');
      } else {
        setGameError('视频合并失败: ' + (response.data.error || '未知错误'));
      }
    } catch (error) {
      console.error('视频合并错误:', error);
      setGameError('视频合并服务出错: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsExportingVideo(false);
    }
  };

  // 开始新游戏
  const startNewGame = () => {
    setGameLog([]);
    fetchRandomPrompts();
    setGameStarted(false);
    setCurrentSentence(null);
    setNextOptions([]);
    setClipUrls([]);
    setVideoUrl('');
    setSelectedOption(null);
    setIsConfirmMode(false);
  };

  // 初始加载时获取随机提示
  useEffect(() => {
    if (apiStatus === 'connected') {
      fetchRandomPrompts();
    }
  }, [apiStatus]);

  return (
    <div className="chain-game-container">
      <div className="drama-selector">
        <div className="drama-selector-header">
          <h3>选择剧集</h3>
          <button 
            type="button" 
            className="toggle-all-button"
            onClick={toggleAllDramas}
          >
            {selectedDramas.length === availableDramas.length ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="drama-checkbox-container">
          {availableDramas.map(drama => (
            <div className="drama-checkbox" key={drama.id}>
              <input
                type="checkbox"
                id={`chain-drama-${drama.id}`}
                checked={selectedDramas.includes(drama.id)}
                onChange={() => handleDramaChange(drama.id)}
              />
              <label htmlFor={`chain-drama-${drama.id}`}>
                {formatDramaName(drama)}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="game-controls">
        <button 
          onClick={startNewGame}
          className="new-game-btn"
          disabled={apiStatus !== 'connected'}
        >
          新游戏
        </button>
        {gameStarted && (
          <button 
            onClick={goBackOneStep}
            className="back-btn"
            disabled={gameLog.length === 0}
          >
            上一步
          </button>
        )}
        {clipUrls.length > 1 && (
          <button
            onClick={exportMergedVideo}
            className="export-btn"
            disabled={isExportingVideo}
          >
            {isExportingVideo ? '导出中...' : '导出接龙视频'}
          </button>
        )}
      </div>
      
      {gameError && <div className="error-message">{gameError}</div>}
      
      <div className="game-content">
        {/* 左侧：候选词区域 */}
        <div className="game-candidates">
          {!gameStarted ? (
            <div className="start-game-section">
              <div className="section-header">
                <h2>选择开始句子</h2>
                <button 
                  onClick={refreshRandomPrompts}
                  className="refresh-btn"
                  disabled={loadingPrompts || apiStatus !== 'connected'}
                >
                  换一批
                </button>
              </div>
              
              {loadingPrompts ? (
                <div className="loading">加载提示句子中...</div>
              ) : (
                <ul className="prompts-list">
                  {currentPrompts.map((prompt, index) => (
                    <li 
                      key={index} 
                      onClick={() => selectStartSentence(prompt)}
                      className={selectedOption === prompt ? 'prompt-item selected' : 'prompt-item'}
                    >
                      <div className="prompt-text">{prompt.text}</div>
                      <div className="prompt-info">
                        <span className="drama-name">{formatDramaName({id: prompt.drama_id})}</span>
                        <span className="episode">{formatEpisode(prompt.episode)}</span>
                        <span className="time">{formatTime(prompt.start_seconds)}</span>
                        <span className={`sentence-type ${analyzeSentenceType(prompt.text)}`}>{analyzeSentenceType(prompt.text)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {currentPrompts.length === 0 && !loadingPrompts && (
                <div className="empty-prompts">
                  <p>没有可用的提示句子</p>
                  <button onClick={refreshRandomPrompts}>重新获取</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="current-section">
                <h2>当前句子</h2>
                <div className="current-sentence">
                  <div className="current-text">{currentSentence?.text}</div>
                  <div className="current-info">
                    <span className="drama-name">{formatDramaName({id: currentSentence?.drama_id})}</span>
                    <span className="episode">{formatEpisode(currentSentence?.episode)}</span>
                    <span className="time">{formatTime(currentSentence?.start_seconds)}</span>
                  </div>
                  <div className="next-hint">
                    下一句需以「{getLastValidChar(currentSentence?.text)}」字开头
                  </div>
                </div>
              </div>
                
              <div className="next-options-section">
                <div className="section-header">
                  <h2>可选接续</h2>
                  <button 
                    onClick={refreshNextOptions}
                    className="refresh-btn"
                    disabled={loadingNextOptions}
                  >
                    换一批
                  </button>
                </div>
                
                {loadingNextOptions ? (
                  <div className="loading">加载接续句子中...</div>
                ) : (
                  <ul className="options-list">
                    {nextOptions.map((option, index) => (
                      <li 
                        key={index}
                        onClick={() => selectNextSentence(option)}
                        className={selectedOption === option ? 'option-item selected' : 'option-item'}
                      >
                        <div className="option-text">{option.text}</div>
                        <div className="option-info">
                          <span className="drama-name">{formatDramaName({id: option.drama_id})}</span>
                          <span className="episode">{formatEpisode(option.episode)}</span>
                          <span className="time">{formatTime(option.start_seconds)}</span>
                          <span className={`sentence-type ${analyzeSentenceType(option.text)}`}>{analyzeSentenceType(option.text)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {nextOptions.length === 0 && !loadingNextOptions && (
                  <div className="no-options">
                    <p>没有找到合适的接续句子</p>
                    <button onClick={startNewGame}>重新开始</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 接龙记录 */}
          <div className="game-log-section">
            <h2>接龙记录</h2>
            {gameLog.length > 0 ? (
              <ol className="game-log-list">
                {gameLog.map((log, index) => (
                  <li key={index} className="log-item">
                    <div className="log-text">{log.text}</div>
                    <div className="log-info">
                      <span className="drama-name">{formatDramaName({id: log.drama_id})}</span>
                      <span className="episode">{formatEpisode(log.episode)}</span>
                      <span className="time">{formatTime(log.start_seconds)}</span>
                      {log.clipUrl && (
                        <span className="clip-info">
                          <i className="video-icon">🎬</i>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-log">尚未开始游戏</div>
            )}
          </div>
        </div>

        {/* 右侧：视频预览区域 */}
        <div className="game-video-preview">
          {isConfirmMode && (
            <div className="confirm-section">
              <div className="selected-sentence">
                <div className="selected-text">{selectedOption?.text}</div>
                <div className="selected-info">
                  <span className="drama-name">{formatDramaName({id: selectedOption?.drama_id})}</span>
                  <span className="episode">{formatEpisode(selectedOption?.episode)}</span>
                  <span className="time">{formatTime(selectedOption?.start_seconds)}</span>
                </div>
              </div>
              
              <div className="video-preview">
                {isVideoLoading ? (
                  <div className="loading-video">生成视频片段中，请稍候...</div>
                ) : videoUrl ? (
                  <video 
                    controls 
                    autoPlay 
                    className="video-element"
                    src={videoUrl}
                  />
                ) : (
                  <div className="video-placeholder">准备生成视频片段...</div>
                )}
              </div>
              
              <div className="confirm-buttons">
                <button 
                  className="confirm-btn"
                  onClick={gameStarted ? confirmNextSentence : confirmStartSentence}
                  disabled={isVideoLoading || !videoUrl}
                >
                  确认选择
                </button>
                <button 
                  className="cancel-btn"
                  onClick={cancelSelection}
                >
                  取消选择
                </button>
              </div>
            </div>
          )}
          {!isConfirmMode && (
            <div className="video-section">
              <h2>视频预览</h2>
              {isVideoLoading ? (
                <div className="loading-video">生成视频片段中，请稍候...</div>
              ) : videoUrl ? (
                <video 
                  controls 
                  autoPlay 
                  className="video-element"
                  src={videoUrl}
                />
              ) : (
                <div className="video-placeholder large">
                  <div className="placeholder-text">
                    <p>请从左侧选择一个句子</p>
                    <p>选择后将在此处预览视频</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 押韵游戏组件
const RhymeGamePage = ({ 
  API_BASE_URL, 
  apiStatus,
  formatTime,
  formatEpisode,
  availableDramas,
  formatDramaName
}) => {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentPrompts, setCurrentPrompts] = useState([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [currentSentence, setCurrentSentence] = useState(null);
  const [nextOptions, setNextOptions] = useState([]);
  const [loadingNextOptions, setLoadingNextOptions] = useState(false);
  const [gameError, setGameError] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [clipUrls, setClipUrls] = useState([]);
  const [isConfirmMode, setIsConfirmMode] = useState(false);
  const [selectedDramas, setSelectedDramas] = useState(
    availableDramas ? availableDramas.map(drama => drama.id) : []
  );

  // 处理剧集选择变化
  const handleDramaChange = (dramaId) => {
    if (selectedDramas.includes(dramaId)) {
      // 如果已经选中，则从数组中移除
      setSelectedDramas(selectedDramas.filter(id => id !== dramaId));
    } else {
      // 如果未选中，则添加到数组
      setSelectedDramas([...selectedDramas, dramaId]);
    }
  };

  // 选择/取消选择所有剧集
  const toggleAllDramas = () => {
    if (selectedDramas.length === availableDramas.length) {
      // 如果已选择所有剧集，则取消选择所有
      setSelectedDramas([]);
    } else {
      // 选择所有剧集
      setSelectedDramas(availableDramas.map(drama => drama.id));
    }
  };

  // 获取随机提示句子
  const fetchRandomPrompts = async () => {
    if (selectedDramas.length === 0) {
      setGameError('请至少选择一个剧集');
      return;
    }
    
    setLoadingPrompts(true);
    setGameError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/random_sentences`, {
        params: {
          count: 8,
          drama_ids: selectedDramas.join(',')
        }
      });
      
      if (response.data && response.data.results) {
        setCurrentPrompts(response.data.results);
      } else {
        setGameError('获取随机句子失败');
      }
    } catch (error) {
      console.error('获取随机句子错误:', error);
      setGameError('无法获取随机句子');
    } finally {
      setLoadingPrompts(false);
    }
  };

  // 刷新随机提示
  const refreshRandomPrompts = () => {
    if (apiStatus === 'connected' && !loadingPrompts) {
      fetchRandomPrompts();
    }
  };

  // 生成视频片段
  const generateVideoClip = async (subtitle) => {
    setIsVideoLoading(true);
    setVideoUrl('');
    setGameError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate_clip`, {
        drama_id: subtitle.drama_id,
        episode: subtitle.episode,
        start_time: subtitle.start_seconds,
        end_time: subtitle.end_seconds,
        context_seconds: 2
      });

      if (response.data && response.data.clip_url) {
        const clipUrl = `${API_BASE_URL}${response.data.clip_url}`;
        setVideoUrl(clipUrl);
        return clipUrl;
      } else {
        setGameError('生成视频片段失败');
        return null;
      }
    } catch (error) {
      console.error('生成视频片段出错:', error);
      setGameError('视频服务出现错误，请确保视频文件存在且可访问');
      return null;
    } finally {
      setIsVideoLoading(false);
    }
  };

  // 选择开始句子
  const selectStartSentence = (prompt) => {
    setSelectedOption(prompt);
    setIsConfirmMode(true);
    generateVideoClip(prompt);
  };

  // 确认选择开始句子
  const confirmStartSentence = () => {
    const sentence = selectedOption;
    if (!sentence) return;
    
    setCurrentSentence(sentence);
    setGameLog([{...sentence, step: 1, clipUrl: videoUrl}]);
    setClipUrls([...clipUrls, videoUrl]);
    setGameStarted(true);
    fetchRhymingOptions(sentence.text);
    setIsConfirmMode(false);
    setSelectedOption(null);
  };

  // 取消选择
  const cancelSelection = () => {
    setIsConfirmMode(false);
    setSelectedOption(null);
    setVideoUrl('');
  };
  
  // 选择下一个句子
  const selectNextSentence = (option) => {
    setSelectedOption(option);
    setIsConfirmMode(true);
    generateVideoClip(option);
  };

  // 确认选择下一个句子
  const confirmNextSentence = () => {
    const sentence = selectedOption;
    if (!sentence) return;
    
    setCurrentSentence(sentence);
    setGameLog([...gameLog, {...sentence, step: gameLog.length + 1, clipUrl: videoUrl}]);
    setClipUrls([...clipUrls, videoUrl]);
    fetchRhymingOptions(sentence.text);
    setIsConfirmMode(false);
    setSelectedOption(null);
  };

  // 查找韵脚匹配的选项
  const fetchRhymingOptions = async (text) => {
    if (!text) return;
    
    setLoadingNextOptions(true);
    setGameError(null);
    
    try {
      // 确保有选择的剧集
      if (selectedDramas.length === 0) {
        setGameError('请至少选择一个剧集');
        setLoadingNextOptions(false);
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/rhyming_sentences`, {
        params: {
          text: text,
          min_length: 3,
          max_length: 20,
          limit: 8,
          drama_ids: selectedDramas.join(',')
        }
      });
      
      if (response.data && response.data.results) {
        setNextOptions(response.data.results);
      } else {
        setGameError('获取押韵选项失败');
      }
    } catch (error) {
      console.error('获取押韵选项错误:', error);
      setGameError('无法获取押韵选项');
    } finally {
      setLoadingNextOptions(false);
    }
  };

  // 获取最后一个有效字符（排除语气词）
  const getLastValidChar = (text) => {
    if (!text || text.length === 0) return null;
    
    // 排除常见语气词
    const cleanText = text.replace(/[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$/, '');
    return cleanText.length > 0 ? cleanText[cleanText.length - 1] : null;
  };

  // 刷新下一步选项
  const refreshNextOptions = () => {
    if (currentSentence && !loadingNextOptions) {
      fetchRhymingOptions(currentSentence.text);
    }
  };

  // 回到上一步
  const goBackOneStep = () => {
    if (gameLog.length <= 1) {
      // 只有一步，回到选择开始句子
      setGameStarted(false);
      setGameLog([]);
      setCurrentSentence(null);
      setNextOptions([]);
      setClipUrls([]);
      setVideoUrl('');
      fetchRandomPrompts();
    } else {
      // 移除最后一步
      const newLog = [...gameLog];
      newLog.pop();
      setGameLog(newLog);
      
      // 更新当前句子和视频
      const prevSentence = newLog[newLog.length - 1];
      setCurrentSentence(prevSentence);
      
      // 更新剪辑URL列表
      const newClipUrls = [...clipUrls];
      newClipUrls.pop();
      setClipUrls(newClipUrls);
      
      // 重新获取选项
      fetchRhymingOptions(prevSentence.text);
    }
  };

  // 合并视频并导出
  const exportMergedVideo = async () => {
    if (clipUrls.length === 0) return;
    
    setIsExportingVideo(true);
    setGameError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/merge_clips`, {
        clip_urls: clipUrls
      });
      
      if (response.data && response.data.merged_url) {
        const mergedVideoUrl = `${API_BASE_URL}${response.data.merged_url}`;
        
        // 创建下载链接并强制触发下载
        const link = document.createElement('a');
        link.href = mergedVideoUrl;
        link.download = '押韵视频.mp4';
        link.target = '_blank';
        document.body.appendChild(link); // 必须添加到DOM中
        link.click();
        setTimeout(() => {
          document.body.removeChild(link); // 清理DOM
        }, 100);
        
        console.log('视频合并成功，已触发下载');
      } else {
        setGameError('视频合并失败: ' + (response.data.error || '未知错误'));
      }
    } catch (error) {
      console.error('视频合并错误:', error);
      setGameError('视频合并服务出错: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsExportingVideo(false);
    }
  };

  // 开始新游戏
  const startNewGame = () => {
    setGameLog([]);
    fetchRandomPrompts();
    setGameStarted(false);
    setCurrentSentence(null);
    setNextOptions([]);
    setClipUrls([]);
    setVideoUrl('');
    setSelectedOption(null);
    setIsConfirmMode(false);
  };

  // 初始加载时获取随机提示
  useEffect(() => {
    if (apiStatus === 'connected') {
      fetchRandomPrompts();
    }
  }, [apiStatus]);

  return (
    <div className="chain-game-container">
      <div className="drama-selector">
        <div className="drama-selector-header">
          <h3>选择剧集</h3>
          <button 
            type="button" 
            className="toggle-all-button"
            onClick={toggleAllDramas}
          >
            {selectedDramas.length === availableDramas.length ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="drama-checkbox-container">
          {availableDramas.map(drama => (
            <div className="drama-checkbox" key={drama.id}>
              <input
                type="checkbox"
                id={`rhyme-drama-${drama.id}`}
                checked={selectedDramas.includes(drama.id)}
                onChange={() => handleDramaChange(drama.id)}
              />
              <label htmlFor={`rhyme-drama-${drama.id}`}>
                {formatDramaName(drama)}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="game-controls">
        <button 
          onClick={startNewGame}
          className="new-game-btn"
          disabled={apiStatus !== 'connected'}
        >
          新游戏
        </button>
        {gameStarted && (
          <button 
            onClick={goBackOneStep}
            className="back-btn"
            disabled={gameLog.length === 0}
          >
            上一步
          </button>
        )}
        {clipUrls.length > 1 && (
          <button
            onClick={exportMergedVideo}
            className="export-btn"
            disabled={isExportingVideo}
          >
            {isExportingVideo ? '导出中...' : '导出押韵视频'}
          </button>
        )}
      </div>
      
      {gameError && <div className="error-message">{gameError}</div>}
      
      <div className="game-content">
        {/* 左侧：候选词区域 */}
        <div className="game-candidates">
          {!gameStarted ? (
            <div className="start-game-section">
              <div className="section-header">
                <h2>选择开始句子</h2>
                <button 
                  onClick={refreshRandomPrompts}
                  className="refresh-btn"
                  disabled={loadingPrompts || apiStatus !== 'connected'}
                >
                  换一批
                </button>
              </div>
              
              {loadingPrompts ? (
                <div className="loading">加载提示句子中...</div>
              ) : (
                <ul className="prompts-list">
                  {currentPrompts.map((prompt, index) => (
                    <li 
                      key={index} 
                      onClick={() => selectStartSentence(prompt)}
                      className={selectedOption === prompt ? 'prompt-item selected' : 'prompt-item'}
                    >
                      <div className="prompt-text">{prompt.text}</div>
                      <div className="prompt-info">
                        <span className="drama-name">{formatDramaName({id: prompt.drama_id})}</span>
                        <span className="episode">{formatEpisode(prompt.episode)}</span>
                        <span className="time">{formatTime(prompt.start_seconds)}</span>
                        <span className={`sentence-type ${analyzeSentenceType(prompt.text)}`}>{analyzeSentenceType(prompt.text)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {currentPrompts.length === 0 && !loadingPrompts && (
                <div className="empty-prompts">
                  <p>没有可用的提示句子</p>
                  <button onClick={refreshRandomPrompts}>重新获取</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="current-section">
                <h2>当前句子</h2>
                <div className="current-sentence">
                  <div className="current-text">{currentSentence?.text}</div>
                  <div className="current-info">
                    <span className="drama-name">{formatDramaName({id: currentSentence?.drama_id})}</span>
                    <span className="episode">{formatEpisode(currentSentence?.episode)}</span>
                    <span className="time">{formatTime(currentSentence?.start_seconds)}</span>
                  </div>
                  <div className="next-hint">
                    下一句需与此句韵脚相同
                  </div>
                </div>
              </div>
                
              <div className="next-options-section">
                <div className="section-header">
                  <h2>押韵选项</h2>
                  <button 
                    onClick={refreshNextOptions}
                    className="refresh-btn"
                    disabled={loadingNextOptions}
                  >
                    换一批
                  </button>
                </div>
                
                {loadingNextOptions ? (
                  <div className="loading">查找押韵句子中...</div>
                ) : (
                  <ul className="options-list">
                    {nextOptions.map((option, index) => (
                      <li 
                        key={index}
                        onClick={() => selectNextSentence(option)}
                        className={selectedOption === option ? 'option-item selected' : 'option-item'}
                      >
                        <div className="option-text">{option.text}</div>
                        <div className="option-info">
                          <span className="drama-name">{formatDramaName({id: option.drama_id})}</span>
                          <span className="episode">{formatEpisode(option.episode)}</span>
                          <span className="time">{formatTime(option.start_seconds)}</span>
                          <span className={`sentence-type ${analyzeSentenceType(option.text)}`}>{analyzeSentenceType(option.text)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {nextOptions.length === 0 && !loadingNextOptions && (
                  <div className="no-options">
                    <p>没有找到合适的押韵句子</p>
                    <button onClick={startNewGame}>重新开始</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 押韵记录 */}
          <div className="game-log-section">
            <h2>押韵记录</h2>
            {gameLog.length > 0 ? (
              <ol className="game-log-list">
                {gameLog.map((log, index) => (
                  <li key={index} className="log-item">
                    <div className="log-text">{log.text}</div>
                    <div className="log-info">
                      <span className="drama-name">{formatDramaName({id: log.drama_id})}</span>
                      <span className="episode">{formatEpisode(log.episode)}</span>
                      <span className="time">{formatTime(log.start_seconds)}</span>
                      {log.clipUrl && (
                        <span className="clip-info">
                          <i className="video-icon">🎬</i>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-log">尚未开始游戏</div>
            )}
          </div>
        </div>

        {/* 右侧：视频预览区域 */}
        <div className="game-video-preview">
          {isConfirmMode && (
            <div className="confirm-section">
              <div className="selected-sentence">
                <div className="selected-text">{selectedOption?.text}</div>
                <div className="selected-info">
                  <span className="drama-name">{formatDramaName({id: selectedOption?.drama_id})}</span>
                  <span className="episode">{formatEpisode(selectedOption?.episode)}</span>
                  <span className="time">{formatTime(selectedOption?.start_seconds)}</span>
                </div>
              </div>
              
              <div className="video-preview">
                {isVideoLoading ? (
                  <div className="loading-video">生成视频片段中，请稍候...</div>
                ) : videoUrl ? (
                  <video 
                    controls 
                    autoPlay 
                    className="video-element"
                    src={videoUrl}
                  />
                ) : (
                  <div className="video-placeholder">准备生成视频片段...</div>
                )}
              </div>
              
              <div className="confirm-buttons">
                <button 
                  className="confirm-btn"
                  onClick={gameStarted ? confirmNextSentence : confirmStartSentence}
                  disabled={isVideoLoading || !videoUrl}
                >
                  确认选择
                </button>
                <button 
                  className="cancel-btn"
                  onClick={cancelSelection}
                >
                  取消选择
                </button>
              </div>
            </div>
          )}
          {!isConfirmMode && (
            <div className="video-section">
              <h2>视频预览</h2>
              {isVideoLoading ? (
                <div className="loading-video">生成视频片段中，请稍候...</div>
              ) : videoUrl ? (
                <video 
                  controls 
                  autoPlay 
                  className="video-element"
                  src={videoUrl}
                />
              ) : (
                <div className="video-placeholder large">
                  <div className="placeholder-text">
                    <p>请从左侧选择一个句子</p>
                    <p>选择后将在此处预览视频</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 分析句子类型 - 全局辅助函数
const analyzeSentenceType = (text) => {
  if (!text) return '普通句';
  
  // 判断是否为问句
  if (text.includes('?') || text.includes('？') || text.includes('吗') || text.includes('呢')) {
    return '疑问句';
  }
  
  // 判断是否为命令句
  const commandWords = ['去', '来', '给我', '快', '立刻', '马上', '传'];
  if (commandWords.some(word => text.includes(word))) {
    return '命令句';
  }
  
  // 判断情感色彩
  const positiveWords = ['好', '愿意', '可以', '是', '对', '喜欢', '爱', '高兴'];
  const negativeWords = ['不', '没', '别', '莫', '拒绝', '难过', '恨', '讨厌'];
  
  if (positiveWords.some(word => text.includes(word))) {
    return '积极句';
  }
  
  if (negativeWords.some(word => text.includes(word))) {
    return '消极句';
  }
  
  return '普通句';
};

// 奇妙对话组件
const DialogueGamePage = ({ 
  API_BASE_URL, 
  apiStatus,
  formatTime,
  formatEpisode,
  availableDramas,
  formatDramaName
}) => {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentPrompts, setCurrentPrompts] = useState([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [currentSentence, setCurrentSentence] = useState(null);
  const [nextOptions, setNextOptions] = useState([]);
  const [loadingNextOptions, setLoadingNextOptions] = useState(false);
  const [gameError, setGameError] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [clipUrls, setClipUrls] = useState([]);
  const [isConfirmMode, setIsConfirmMode] = useState(false);
  const [selectedDramas, setSelectedDramas] = useState(
    availableDramas ? availableDramas.map(drama => drama.id) : []
  );

  // 处理剧集选择变化
  const handleDramaChange = (dramaId) => {
    if (selectedDramas.includes(dramaId)) {
      // 如果已经选中，则从数组中移除
      setSelectedDramas(selectedDramas.filter(id => id !== dramaId));
    } else {
      // 如果未选中，则添加到数组
      setSelectedDramas([...selectedDramas, dramaId]);
    }
  };

  // 选择/取消选择所有剧集
  const toggleAllDramas = () => {
    if (selectedDramas.length === availableDramas.length) {
      // 如果已选择所有剧集，则取消选择所有
      setSelectedDramas([]);
    } else {
      // 选择所有剧集
      setSelectedDramas(availableDramas.map(drama => drama.id));
    }
  };

  // 获取随机提示句子
  const fetchRandomPrompts = async () => {
    if (selectedDramas.length === 0) {
      setGameError('请至少选择一个剧集');
      return;
    }
    
    setLoadingPrompts(true);
    setGameError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/random_sentences`, {
        params: {
          count: 8,
          drama_ids: selectedDramas.join(',')
        }
      });
      
      if (response.data && response.data.results) {
        setCurrentPrompts(response.data.results);
      } else {
        setGameError('获取随机句子失败');
      }
    } catch (error) {
      console.error('获取随机句子错误:', error);
      setGameError('无法获取随机句子');
    } finally {
      setLoadingPrompts(false);
    }
  };

  // 刷新随机提示
  const refreshRandomPrompts = () => {
    if (apiStatus === 'connected' && !loadingPrompts) {
      fetchRandomPrompts();
    }
  };

  // 生成视频片段
  const generateVideoClip = async (subtitle) => {
    setIsVideoLoading(true);
    setVideoUrl('');
    setGameError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate_clip`, {
        drama_id: subtitle.drama_id,
        episode: subtitle.episode,
        start_time: subtitle.start_seconds,
        end_time: subtitle.end_seconds,
        context_seconds: 2
      });

      if (response.data && response.data.clip_url) {
        const clipUrl = `${API_BASE_URL}${response.data.clip_url}`;
        setVideoUrl(clipUrl);
        return clipUrl;
      } else {
        setGameError('生成视频片段失败');
        return null;
      }
    } catch (error) {
      console.error('生成视频片段出错:', error);
      setGameError('视频服务出现错误，请确保视频文件存在且可访问');
      return null;
    } finally {
      setIsVideoLoading(false);
    }
  };

  // 选择开始句子
  const selectStartSentence = (prompt) => {
    setSelectedOption(prompt);
    setIsConfirmMode(true);
    generateVideoClip(prompt);
  };

  // 确认选择开始句子
  const confirmStartSentence = () => {
    const sentence = selectedOption;
    if (!sentence) return;
    
    setCurrentSentence(sentence);
    setGameLog([{...sentence, step: 1, clipUrl: videoUrl}]);
    setClipUrls([...clipUrls, videoUrl]);
    setGameStarted(true);
    fetchDialogueResponses(sentence);
    setIsConfirmMode(false);
    setSelectedOption(null);
  };

  // 取消选择
  const cancelSelection = () => {
    setIsConfirmMode(false);
    setSelectedOption(null);
    setVideoUrl('');
  };
  
  // 选择下一个句子
  const selectNextSentence = (option) => {
    setSelectedOption(option);
    setIsConfirmMode(true);
    generateVideoClip(option);
  };

  // 确认选择下一个句子
  const confirmNextSentence = () => {
    const sentence = selectedOption;
    if (!sentence) return;
    
    setCurrentSentence(sentence);
    setGameLog([...gameLog, {...sentence, step: gameLog.length + 1, clipUrl: videoUrl}]);
    setClipUrls([...clipUrls, videoUrl]);
    fetchDialogueResponses(sentence);
    setIsConfirmMode(false);
    setSelectedOption(null);
  };

  // 查找对话回应
  const fetchDialogueResponses = async (sentence) => {
    if (!sentence) return;
    
    setLoadingNextOptions(true);
    setGameError(null);
    
    try {
      // 确保有选择的剧集
      if (selectedDramas.length === 0) {
        setGameError('请至少选择一个剧集');
        setLoadingNextOptions(false);
        return;
      }
      
      const response = await axios.post(`${API_BASE_URL}/api/dialogue_responses`, {
        sentence_text: sentence.text,
        drama_id: sentence.drama_id,
        episode: sentence.episode,
        drama_ids: selectedDramas.join(',')
      });
      
      if (response.data && response.data.results) {
        setNextOptions(response.data.results);
      } else {
        setGameError('获取对话回应失败');
      }
    } catch (error) {
      console.error('获取对话回应错误:', error);
      setGameError('无法获取对话回应');
    } finally {
      setLoadingNextOptions(false);
    }
  };

  // 获取最后一个有效字符（排除语气词）
  const getLastValidChar = (text) => {
    if (!text || text.length === 0) return null;
    
    // 排除常见语气词
    const cleanText = text.replace(/[啊呢吗吧呀嘛哦哎嗯呐呵呦诶哈哟了]$/, '');
    return cleanText.length > 0 ? cleanText[cleanText.length - 1] : null;
  };

  // 刷新下一步选项
  const refreshNextOptions = () => {
    if (currentSentence && !loadingNextOptions) {
      fetchDialogueResponses(currentSentence);
    }
  };

  // 回到上一步
  const goBackOneStep = () => {
    if (gameLog.length <= 1) {
      // 只有一步，回到选择开始句子
      setGameStarted(false);
      setGameLog([]);
      setCurrentSentence(null);
      setNextOptions([]);
      setClipUrls([]);
      setVideoUrl('');
      fetchRandomPrompts();
    } else {
      // 移除最后一步
      const newLog = [...gameLog];
      newLog.pop();
      setGameLog(newLog);
      
      // 更新当前句子和视频
      const prevSentence = newLog[newLog.length - 1];
      setCurrentSentence(prevSentence);
      
      // 更新剪辑URL列表
      const newClipUrls = [...clipUrls];
      newClipUrls.pop();
      setClipUrls(newClipUrls);
      
      // 重新获取选项
      fetchDialogueResponses(prevSentence);
    }
  };

  // 合并视频并导出
  const exportMergedVideo = async () => {
    if (clipUrls.length === 0) return;
    
    setIsExportingVideo(true);
    setGameError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/merge_clips`, {
        clip_urls: clipUrls
      });
      
      if (response.data && response.data.merged_url) {
        const mergedVideoUrl = `${API_BASE_URL}${response.data.merged_url}`;
        
        // 创建下载链接并强制触发下载
        const link = document.createElement('a');
        link.href = mergedVideoUrl;
        link.download = '对话视频.mp4';
        link.target = '_blank';
        document.body.appendChild(link); // 必须添加到DOM中
        link.click();
        setTimeout(() => {
          document.body.removeChild(link); // 清理DOM
        }, 100);
        
        console.log('视频合并成功，已触发下载');
      } else {
        setGameError('视频合并失败: ' + (response.data.error || '未知错误'));
      }
    } catch (error) {
      console.error('视频合并错误:', error);
      setGameError('视频合并服务出错: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsExportingVideo(false);
    }
  };

  // 开始新游戏
  const startNewGame = () => {
    setGameLog([]);
    fetchRandomPrompts();
    setGameStarted(false);
    setCurrentSentence(null);
    setNextOptions([]);
    setClipUrls([]);
    setVideoUrl('');
    setSelectedOption(null);
    setIsConfirmMode(false);
  };

  // 初始加载时获取随机提示
  useEffect(() => {
    if (apiStatus === 'connected') {
      fetchRandomPrompts();
    }
  }, [apiStatus]);

  return (
    <div className="chain-game-container">
      <div className="drama-selector">
        <div className="drama-selector-header">
          <h3>选择剧集</h3>
          <button 
            type="button" 
            className="toggle-all-button"
            onClick={toggleAllDramas}
          >
            {selectedDramas.length === availableDramas.length ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="drama-checkbox-container">
          {availableDramas.map(drama => (
            <div className="drama-checkbox" key={drama.id}>
              <input
                type="checkbox"
                id={`dialogue-drama-${drama.id}`}
                checked={selectedDramas.includes(drama.id)}
                onChange={() => handleDramaChange(drama.id)}
              />
              <label htmlFor={`dialogue-drama-${drama.id}`}>
                {formatDramaName(drama)}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="game-controls">
        <button 
          onClick={startNewGame}
          className="new-game-btn"
          disabled={apiStatus !== 'connected'}
        >
          新游戏
        </button>
        {gameStarted && (
          <button 
            onClick={goBackOneStep}
            className="back-btn"
            disabled={gameLog.length === 0}
          >
            上一步
          </button>
        )}
        {clipUrls.length > 1 && (
          <button
            onClick={exportMergedVideo}
            className="export-btn"
            disabled={isExportingVideo}
          >
            {isExportingVideo ? '导出中...' : '导出对话视频'}
          </button>
        )}
      </div>
      
      {gameError && <div className="error-message">{gameError}</div>}
      
      <div className="game-content">
        {/* 左侧：候选词区域 */}
        <div className="game-candidates">
          {!gameStarted ? (
            <div className="start-game-section">
              <div className="section-header">
                <h2>选择开始句子</h2>
                <button 
                  onClick={refreshRandomPrompts}
                  className="refresh-btn"
                  disabled={loadingPrompts || apiStatus !== 'connected'}
                >
                  换一批
                </button>
              </div>
              
              {loadingPrompts ? (
                <div className="loading">加载提示句子中...</div>
              ) : (
                <ul className="prompts-list">
                  {currentPrompts.map((prompt, index) => (
                    <li 
                      key={index} 
                      onClick={() => selectStartSentence(prompt)}
                      className={selectedOption === prompt ? 'prompt-item selected' : 'prompt-item'}
                    >
                      <div className="prompt-text">{prompt.text}</div>
                      <div className="prompt-info">
                        <span className="drama-name">{formatDramaName({id: prompt.drama_id})}</span>
                        <span className="episode">{formatEpisode(prompt.episode)}</span>
                        <span className="time">{formatTime(prompt.start_seconds)}</span>
                        <span className={`sentence-type ${analyzeSentenceType(prompt.text)}`}>{analyzeSentenceType(prompt.text)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {currentPrompts.length === 0 && !loadingPrompts && (
                <div className="empty-prompts">
                  <p>没有可用的提示句子</p>
                  <button onClick={refreshRandomPrompts}>重新获取</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="current-section">
                <h2>当前句子</h2>
                <div className="current-sentence">
                  <div className="current-text">{currentSentence?.text}</div>
                  <div className="current-info">
                    <span className="drama-name">{formatDramaName({id: currentSentence?.drama_id})}</span>
                    <span className="episode">{formatEpisode(currentSentence?.episode)}</span>
                    <span className="time">{formatTime(currentSentence?.start_seconds)}</span>
                  </div>
                  <div className="next-hint">
                    查找适合的回应句子
                  </div>
                </div>
              </div>
                
              <div className="next-options-section">
                <div className="section-header">
                  <h2>回应选项</h2>
                  <button 
                    onClick={refreshNextOptions}
                    className="refresh-btn"
                    disabled={loadingNextOptions}
                  >
                    换一批
                  </button>
                </div>
                
                {loadingNextOptions ? (
                  <div className="loading">查找回应句子中...</div>
                ) : (
                  <ul className="options-list">
                    {nextOptions.map((option, index) => (
                      <li 
                        key={index}
                        onClick={() => selectNextSentence(option)}
                        className={selectedOption === option ? 'option-item selected' : 'option-item'}
                      >
                        <div className="option-text">{option.text}</div>
                        <div className="option-info">
                          <span className="drama-name">{formatDramaName({id: option.drama_id})}</span>
                          <span className="episode">{formatEpisode(option.episode)}</span>
                          <span className="time">{formatTime(option.start_seconds)}</span>
                          <span className={`sentence-type ${analyzeSentenceType(option.text)}`}>{analyzeSentenceType(option.text)}</span>
                          {option.score && (
                            <span className="match-score">
                              匹配度: {Math.round(option.score * 100)}%
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {nextOptions.length === 0 && !loadingNextOptions && (
                  <div className="no-options">
                    <p>没有找到合适的回应句子</p>
                    <button onClick={startNewGame}>重新开始</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 对话记录 */}
          <div className="game-log-section">
            <h2>对话记录</h2>
            {gameLog.length > 0 ? (
              <ol className="game-log-list">
                {gameLog.map((log, index) => (
                  <li key={index} className="log-item">
                    <div className="log-text">{log.text}</div>
                    <div className="log-info">
                      <span className="drama-name">{formatDramaName({id: log.drama_id})}</span>
                      <span className="episode">{formatEpisode(log.episode)}</span>
                      <span className="time">{formatTime(log.start_seconds)}</span>
                      {log.clipUrl && (
                        <span className="clip-info">
                          <i className="video-icon">🎬</i>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-log">尚未开始游戏</div>
            )}
          </div>
        </div>

        {/* 右侧：视频预览区域 */}
        <div className="game-video-preview">
          {isConfirmMode && (
            <div className="confirm-section">
              <div className="selected-sentence">
                <div className="selected-text">{selectedOption?.text}</div>
                <div className="selected-info">
                  <span className="drama-name">{formatDramaName({id: selectedOption?.drama_id})}</span>
                  <span className="episode">{formatEpisode(selectedOption?.episode)}</span>
                  <span className="time">{formatTime(selectedOption?.start_seconds)}</span>
                </div>
              </div>
              
              <div className="video-preview">
                {isVideoLoading ? (
                  <div className="loading-video">生成视频片段中，请稍候...</div>
                ) : videoUrl ? (
                  <video 
                    controls 
                    autoPlay 
                    className="video-element"
                    src={videoUrl}
                  />
                ) : (
                  <div className="video-placeholder">准备生成视频片段...</div>
                )}
              </div>
              
              <div className="confirm-buttons">
                <button 
                  className="confirm-btn"
                  onClick={gameStarted ? confirmNextSentence : confirmStartSentence}
                  disabled={isVideoLoading || !videoUrl}
                >
                  确认选择
                </button>
                <button 
                  className="cancel-btn"
                  onClick={cancelSelection}
                >
                  取消选择
                </button>
              </div>
            </div>
          )}
          {!isConfirmMode && (
            <div className="video-section">
              <h2>视频预览</h2>
              {isVideoLoading ? (
                <div className="loading-video">生成视频片段中，请稍候...</div>
              ) : videoUrl ? (
                <video 
                  controls 
                  autoPlay 
                  className="video-element"
                  src={videoUrl}
                />
              ) : (
                <div className="video-placeholder large">
                  <div className="placeholder-text">
                    <p>请从左侧选择一个句子</p>
                    <p>选择后将在此处预览视频</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  const API_BASE_URL = 'http://localhost:8089';
  
  // 搜索页面状态
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('unknown');
  const [error, setError] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState('search');
  
  // 剧集相关状态
  const [availableDramas, setAvailableDramas] = useState([]);
  const [selectedDramas, setSelectedDramas] = useState([]);
  const [dramaStats, setDramaStats] = useState({});

  useEffect(() => {
    checkApiStatus();
  }, []);
  
  // 获取API状态并加载可用剧集
  const checkApiStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/status`);
      if (response.data && response.data.status === 'ok') {
        setApiStatus('connected');
        
        // 保存剧集信息
        if (response.data.dramas) {
          setAvailableDramas(response.data.dramas);
          // 默认选择所有可用剧集
          setSelectedDramas(response.data.dramas.map(drama => drama.id));
        }
        
        // 保存剧集统计信息
        if (response.data.drama_stats) {
          setDramaStats(response.data.drama_stats);
        }
      } else {
        setApiStatus('error');
        setError('API服务状态异常');
      }
    } catch (error) {
      console.error('API状态检查错误:', error);
      setApiStatus('disconnected');
      setError('无法连接到API服务，请确保服务器已启动');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearchResults([]);
    setSelectedResult(null);
    setVideoUrl('');
    
    if (!query.trim()) {
      setError('请输入搜索关键词');
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/search`, {
        params: {
          query: query,
          drama_ids: selectedDramas.join(',')
        }
      });
      
      if (response.data && response.data.results) {
        setSearchResults(response.data.results);
        if (response.data.results.length === 0) {
          setError('没有找到匹配的结果');
        }
      } else {
        setError('搜索失败');
      }
    } catch (error) {
      console.error('搜索错误:', error);
      setError('搜索请求失败，请确保API服务正常运行');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateClip = async (result) => {
    if (isVideoLoading) return;
    
    setSelectedResult(result);
    setIsVideoLoading(true);
    setVideoUrl('');
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate_clip`, {
        drama_id: result.drama_id,
        episode: result.episode,
        start_time: result.start_seconds,
        end_time: result.end_seconds,
        context_seconds: 2
      });
      
      if (response.data && response.data.clip_url) {
        const url = `${API_BASE_URL}${response.data.clip_url}`;
        setVideoUrl(url);
      } else {
        setError('无法生成视频片段');
      }
    } catch (error) {
      console.error('生成视频片段失败:', error);
      setError('请求失败，请检查网络连接');
    } finally {
      setIsVideoLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatEpisode = (episode) => {
    // 从集数名称中提取数字
    const match = episode.match(/\d+/);
    if (match) {
      return `第${match[0]}集`;
    }
    return episode;
  };
 
  const formatDramaName = (drama) => {
    // 根据drama_id获取剧名
    if (!drama || !drama.id) return '未知剧集';
    
    // 如果传入的是完整drama对象，则直接返回名称
    if (drama.name) return drama.name;
    
    // 否则在availableDramas中查找
    const foundDrama = availableDramas.find(d => d.id === drama.id);
    return foundDrama ? foundDrama.name : drama.id;
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    
    // 简单的字符串替换，为匹配的文本添加高亮标签
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'gi');
    return text.replace(regex, match => `<span class="highlight">${match}</span>`);
  };

  const switchPage = (page) => {
    setCurrentPage(page);
    setError(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>字幕搜索系统</h1>
        
        <div className="api-status">
          API服务状态: 
          {apiStatus === 'connected' ? (
            <span className="status-connected">已连接</span>
          ) : apiStatus === 'disconnected' ? (
            <span className="status-disconnected">未连接</span>
          ) : (
            <span className="status-checking">检查中...</span>
          )}
        </div>
        
        <nav className="main-nav">
          <ul>
            <li className={currentPage === 'search' ? 'active' : ''}>
              <button onClick={() => switchPage('search')}>字幕搜索</button>
            </li>
            <li className={currentPage === 'chain-game' ? 'active' : ''}>
              <button onClick={() => switchPage('chain-game')}>字幕接龙</button>
            </li>
            <li className={currentPage === 'rhyme-game' ? 'active' : ''}>
              <button onClick={() => switchPage('rhyme-game')}>字幕押韵</button>
            </li>
            <li className={currentPage === 'dialogue-game' ? 'active' : ''}>
              <button onClick={() => switchPage('dialogue-game')}>奇妙对话</button>
            </li>
          </ul>
        </nav>
      </header>
      
      <main className="App-main">
        {currentPage === 'search' && (
          <SearchPage 
            API_BASE_URL={API_BASE_URL}
            query={query}
            setQuery={setQuery}
            searchResults={searchResults}
            setSearchResults={setSearchResults}
            loading={loading}
            setLoading={setLoading}
            apiStatus={apiStatus}
            error={error}
            setError={setError}
            selectedResult={selectedResult}
            setSelectedResult={setSelectedResult}
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            isVideoLoading={isVideoLoading}
            setIsVideoLoading={setIsVideoLoading}
            handleSearch={handleSearch}
            handleGenerateClip={handleGenerateClip}
            formatTime={formatTime}
            formatEpisode={formatEpisode}
            highlightText={highlightText}
            availableDramas={availableDramas}
            selectedDramas={selectedDramas}
            setSelectedDramas={setSelectedDramas}
            formatDramaName={formatDramaName}
          />
        )}
        
        {currentPage === 'chain-game' && (
          <ChainGamePage 
            API_BASE_URL={API_BASE_URL}
            apiStatus={apiStatus}
            formatTime={formatTime}
            formatEpisode={formatEpisode}
            availableDramas={availableDramas}
            formatDramaName={formatDramaName}
          />
        )}
        
        {currentPage === 'rhyme-game' && (
          <RhymeGamePage 
            API_BASE_URL={API_BASE_URL}
            apiStatus={apiStatus}
            formatTime={formatTime}
            formatEpisode={formatEpisode}
            availableDramas={availableDramas}
            formatDramaName={formatDramaName}
          />
        )}
        
        {currentPage === 'dialogue-game' && (
          <DialogueGamePage 
            API_BASE_URL={API_BASE_URL}
            apiStatus={apiStatus}
            formatTime={formatTime}
            formatEpisode={formatEpisode}
            availableDramas={availableDramas}
            formatDramaName={formatDramaName}
          />
        )}
      </main>
      
      <footer className="App-footer">
        <p>字幕搜索系统 &copy; 2025</p>
      </footer>
    </div>
  );
}

export default App; 