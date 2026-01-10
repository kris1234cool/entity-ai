'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/utils/supabase/client';

interface DigitalHumanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  userId: string;
}

interface DigitalAssets {
  id: string;
  user_id: string;
  voice_id: string | null;
  default_video_url: string | null;
  created_at: string;
  updated_at: string;
}

type UploadType = 'audio' | 'video' | null;
type VoiceSource = 'custom' | 'system';

// 轮询间隔和最大次数
const POLL_INTERVAL = 3000; // 3秒
const MAX_POLL_ATTEMPTS = 200; // 最多轮询 10 分钟 (适配长文案)

// 系统预设音色库 - 3男3女 核心品牌音色
const SYSTEM_VOICES = [
  // 女声
  { id: 'longxiaochun', name: '雅雅', tag: '旗舰', desc: '全能商业', icon: '👑', gender: 'female' },
  { id: 'longxiaowan', name: '小娩', tag: '热粉', desc: '元气少女', icon: '💗', gender: 'female' },
  { id: 'longyebai', name: '白白', tag: '柔情', desc: '温柔邻家', icon: '🌸', gender: 'female' },
  // 男声
  { id: 'longcheng', name: '严选男声', tag: '至尊', desc: '睿智精英', icon: '👔', gender: 'male' },
  { id: 'longlaotie', name: '老铁', tag: '接地', desc: '东北大哥', icon: '🍺', gender: 'male' },
  { id: 'longfei', name: '龙飞', tag: '硬核', desc: '铁血真男', icon: '💪', gender: 'male' },
];

// SSML 标签工具按钮配置
const SSML_TOOLS = [
  { label: '🛑停', tag: '[停顿500ms]', title: '插入停顿' },
  { label: '🌬️气', tag: '[吸气]', title: '插入吸气' },
  { label: '📈重', tag: '[重读]', title: '插入重读' },
  { label: '🐢慢', tag: '[慢读]', title: '插入慢读' },
  { label: '💡思', tag: '[思考]', title: '插入思考停顿' },
];

export default function DigitalHumanDialog({ 
  isOpen, 
  onClose, 
  initialText = '', 
  userId 
}: DigitalHumanDialogProps) {
  const [text, setText] = useState(initialText);
  const [assets, setAssets] = useState<DigitalAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<UploadType>(null);
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 轮询相关状态
  const [isPolling, setIsPolling] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 声音来源相关状态
  const [voiceSource, setVoiceSource] = useState<VoiceSource>('system'); // 默认使用系统音色
  const [selectedSystemVoice, setSelectedSystemVoice] = useState(SYSTEM_VOICES[0].id);
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  // 在光标位置插入文本
  const insertAtCursor = (insertText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newText = before + insertText + after;
    setText(newText);
    
    // 恢复光标位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertText.length, start + insertText.length);
    }, 0);
  };

  // 一键智能润色：根据标点、关键词和段落结构自动插入情感标签
  const handleAutoPolish = () => {
    let polished = text.trim();
    
    // 1. 段首强制增加 [吸气]
    if (!polished.startsWith('[吸气]')) {
      polished = '[吸气]' + polished;
    }
    
    // 2. 在标点符号（，。！？）后插入 [停顿500ms]
    polished = polished.replace(/([，。！？,.!?])/g, '$1[停顿500ms]');
    
    // 3. 逻辑词增强：识别关键词并在其后追加停顿
    const keywords = ['但是', '所以', '其实', '注意', '听好了', '尤其是', '特别注意'];
    keywords.forEach(word => {
      const reg = new RegExp(`(${word})(?!\\[停顿)`, 'g');
      polished = polished.replace(reg, '$1[停顿500ms]');
    });
    
    // 4. 清理冗余标签 (防止重复点击导致标签堆叠)
    polished = polished.replace(/(\[停顿500ms\]){2,}/g, '[停顿500ms]');
    
    setText(polished);
    
    // 保持焦点
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // 判断资产是否就绪（系统音色不需要 voice_id）
  const hasVideo = !!assets?.default_video_url;
  const hasCustomVoice = !!assets?.voice_id;
  const canGenerate = hasVideo && (voiceSource === 'system' || hasCustomVoice);

  // 加载用户资产
  useEffect(() => {
    if (isOpen && userId) {
      loadAssets();
    }
  }, [isOpen, userId]);

  // 更新初始文本
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    }
  }, [initialText]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // 轮询任务状态
  const pollTaskStatus = useCallback(async (currentTaskId: string) => {
    if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
      setIsPolling(false);
      setError('视频合成时间较长，系统仍在后台排队生成中。您可以稍后刷新页面查看，或尝试缩短文案重新生成。');
      return;
    }

    try {
      const res = await fetch(`/api/check-task?taskId=${currentTaskId}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const status = data.output?.task_status;
      console.log(`📊 轮询第 ${pollCountRef.current + 1} 次, 状态: ${status}`);

      if (status === 'SUCCEEDED') {
        // 成功！获取视频 URL
        const videoUrl = data.output?.video_url || data.output?.results?.[0]?.url;
        setFinalVideoUrl(videoUrl);
        setIsPolling(false);
        setStatusText('✅ 视频生成完成！');
      } else if (status === 'FAILED') {
        // 失败
        setIsPolling(false);
        setError(data.output?.message || '视频生成失败，请重试');
      } else {
        // PENDING / RUNNING - 继续轮询
        pollCountRef.current += 1;
        const progress = Math.min(Math.round((pollCountRef.current / MAX_POLL_ATTEMPTS) * 100), 95);
        setStatusText(`视频生成中... ${progress}%`);
        
        pollTimerRef.current = setTimeout(() => {
          pollTaskStatus(currentTaskId);
        }, POLL_INTERVAL);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '查询状态失败';
      setError(msg);
      setIsPolling(false);
    }
  }, []);

  // 当获得 taskId 后开始轮询
  useEffect(() => {
    if (taskId && !finalVideoUrl) {
      pollCountRef.current = 0;
      setIsPolling(true);
      setStatusText('视频生成中，预计需要 1-2 分钟...');
      pollTaskStatus(taskId);
    }
  }, [taskId, finalVideoUrl, pollTaskStatus]);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/digital-assets?userId=${userId}`);
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      console.log('📦 加载资产:', data.assets?.default_video_url);
      setAssets(data.assets);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载资产失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 上传文件到 Supabase Storage
  const uploadToStorage = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const filename = `${folder}/${userId}_${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage
      .from('assets')
      .upload(filename, file, { upsert: true });
    
    if (error) throw new Error(`上传失败: ${error.message}`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/assets/${filename}`;
  };

  // 处理音频上传 (复刻声音)
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading('audio');
    setError(null);
    
    try {
      // 1. 上传到 Supabase Storage
      const audioUrl = await uploadToStorage(file, 'voice_samples');
      
      // 2. 调用 API 复刻声音
      const res = await fetch('/api/digital-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'audio', url: audioUrl })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // 3. 刷新资产
      await loadAssets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '声音复刻失败';
      setError(msg);
    } finally {
      setUploading(null);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  // 处理视频上传
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 文件大小限制 50MB
    const MAX_SIZE_MB = 50;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`视频文件过大，请压缩后重试（最大 ${MAX_SIZE_MB}MB，当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    setUploading('video');
    setError(null);
    
    try {
      // 1. 上传到 Supabase Storage
      const videoUrl = await uploadToStorage(file, 'base_videos');
      console.log('🎥 新视频上传成功:', videoUrl);
      
      // 2. 更新资产
      const res = await fetch('/api/digital-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'video', url: videoUrl })
      });
      
      const data = await res.json();
      console.log('💾 API响应:', data);
      if (data.error) throw new Error(data.error);
      
      // 3. 刷新资产
      await loadAssets();
      console.log('✅ 资产已刷新');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '视频上传失败';
      setError(msg);
    } finally {
      setUploading(null);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // 下载视频 (处理跨域问题)
  const handleDownload = async () => {
    if (!finalVideoUrl) return;
    
    try {
      setStatusText('正在准备下载...');
      
      // 通过 fetch 获取视频
      const response = await fetch(finalVideoUrl);
      const blob = await response.blob();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digital_video_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setStatusText('');
    } catch (err) {
      console.error('下载失败:', err);
      // 如果 fetch 失败，尝试直接打开
      window.open(finalVideoUrl, '_blank');
      setStatusText('');
    }
  };

  // 重置状态，再来一条
  const handleReset = () => {
    setTaskId(null);
    setFinalVideoUrl(null);
    setStatusText('');
    setError(null);
    setIsPolling(false);
    pollCountRef.current = 0;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
    }
  };

  // 生成数字人视频
  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('请输入文案内容');
      return;
    }
    if (!assets?.default_video_url) {
      setError('请先上传底板视频');
      return;
    }
    if (voiceSource === 'custom' && !assets?.voice_id) {
      setError('请先上传声音样本进行复刻');
      return;
    }

    // 根据声音来源选择参数
    const voiceId = voiceSource === 'custom' ? assets.voice_id : selectedSystemVoice;
    const model = voiceSource === 'custom' ? 'cosyvoice-v3-plus' : 'cosyvoice-v1';

    // 🚨 关键调试点：打印将要使用的视频URL
    console.log('🚀 生成视频使用的 video_url:', assets.default_video_url);

    // 重置状态
    handleReset();
    setGenerating(true);
    setStatusText('TTS 音频生成中...');
    
    try {
      const res = await fetch('/api/generate-digital-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: voiceId,
          video_url: assets.default_video_url,
          model: model
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const newTaskId = data.task_id || data.output?.task_id;
      setTaskId(newTaskId);
      // 轮询将由 useEffect 自动触发
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成失败';
      setError(msg);
      setStatusText('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            🎬 一键数字人视频
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 视频生成完成 - 显示播放器 */}
          {finalVideoUrl && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold">✅ 视频生成完成！</p>
              </div>
              
              {/* 视频播放器 */}
              <div className="rounded-xl overflow-hidden bg-black">
                <video 
                  src={finalVideoUrl} 
                  controls 
                  autoPlay
                  playsInline
                  className="w-full max-h-[400px]"
                />
              </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  onClick={handleDownload}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl"
                >
                  ⬇️ 下载视频
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex-1 py-3 rounded-xl"
                >
                  🔄 再来一条
                </Button>
              </div>
            </div>
          )}

          {/* 生成中状态 - 显示进度 */}
          {(generating || isPolling) && !finalVideoUrl && (
            <div className="bg-indigo-50 border border-indigo-200 px-4 py-6 rounded-xl text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-indigo-700 font-medium mt-3">{statusText || '处理中...'}</p>
              <p className="text-xs text-indigo-500 mt-2">请勿关闭弹窗，视频即将自动显示</p>
              {taskId && (
                <p className="text-xs text-slate-400 mt-2 break-all">Task ID: {taskId}</p>
              )}
            </div>
          )}

          {/* 文案输入区 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              📝 口播文案
            </label>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入你想让数字人播报的文案..."
              className="min-h-[120px] resize-none rounded-b-none border-b-0"
            />
            {/* 润色工具栏 */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg">
              {/* 左侧：一键润色 */}
              <button
                onClick={handleAutoPolish}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-medium rounded-full shadow-sm hover:shadow-md transition-all"
              >
                ✨ 一键润色
              </button>
              {/* 右侧：SSML 快捷按钮 */}
              <div className="flex gap-1">
                {SSML_TOOLS.map((tool) => (
                  <button
                    key={tool.tag}
                    onClick={() => insertAtCursor(tool.tag)}
                    title={tool.title}
                    className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-md hover:bg-slate-100 hover:border-slate-300 transition-all"
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {text.length} 字 | 点击工具栏插入语音效果标签
            </p>
          </div>

          {/* 资产配置区 */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="text-sm text-slate-500 mt-2">加载资产中...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 声音来源 Tab 切换 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  🎙️ 选择声音来源
                </label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setVoiceSource('system')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      voiceSource === 'system'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    🎧 系统推荐
                  </button>
                  <button
                    onClick={() => setVoiceSource('custom')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      voiceSource === 'custom'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    📂 我的声音
                  </button>
                </div>
              </div>

              {/* 系统音色选择 - 2列3行卡片布局 */}
              {voiceSource === 'system' && (
                <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                  <div className="grid grid-cols-2 gap-2">
                    {SYSTEM_VOICES.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => setSelectedSystemVoice(voice.id)}
                        className={`relative flex flex-col items-center p-3 rounded-xl transition-all ${
                          selectedSystemVoice === voice.id
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg scale-[1.02]'
                            : 'bg-white text-slate-700 hover:bg-white hover:shadow-md border border-slate-200/50'
                        }`}
                      >
                        {/* 标签 */}
                        <span className={`absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          selectedSystemVoice === voice.id
                            ? 'bg-yellow-400 text-yellow-900'
                            : voice.tag === '旗舰' ? 'bg-amber-100 text-amber-700'
                            : voice.tag === '至尊' ? 'bg-purple-100 text-purple-700'
                            : voice.tag === '热粉' ? 'bg-pink-100 text-pink-700'
                            : voice.tag === '柔情' ? 'bg-rose-100 text-rose-700'
                            : voice.tag === '博学' ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {voice.tag}
                        </span>
                        {/* 图标 */}
                        <span className="text-2xl mb-1">{voice.icon}</span>
                        {/* 名称 */}
                        <p className={`text-sm font-semibold ${
                          selectedSystemVoice === voice.id ? 'text-white' : 'text-slate-800'
                        }`}>
                          {voice.name}
                        </p>
                        {/* 描述 */}
                        <p className={`text-[10px] ${
                          selectedSystemVoice === voice.id ? 'text-indigo-100' : 'text-slate-400'
                        }`}>
                          {voice.desc}
                        </p>
                        {/* 选中标记 */}
                        {selectedSystemVoice === voice.id && (
                          <span className="absolute bottom-1 right-1 text-white/80 text-xs">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 自定义声音上传 */}
              {voiceSource === 'custom' && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-sm text-purple-700 font-medium mb-3">上传声音样本克隆你的声音</p>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,.aac,audio/*"
                    onChange={handleAudioUpload}
                    disabled={uploading !== null}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 disabled:opacity-50"
                  />
                  <p className="text-xs text-purple-500 mt-2">建议上传清晰的 10-30 秒语音</p>
                  {uploading === 'audio' && (
                    <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                      <span className="animate-spin">⏳</span> 声音复刻中，请稍候...
                    </p>
                  )}
                  {hasCustomVoice ? (
                    <p className="text-xs text-green-600 mt-2">✅ 声音已克隆就绪</p>
                  ) : (
                    <p className="text-xs text-orange-500 mt-2">⚠️ 请上传声音样本</p>
                  )}
                </div>
              )}

              {/* 底板视频上传 - 两个Tab共用 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-700 font-medium mb-3">🎥 底板视频（数字人形象）</p>
                {hasVideo ? (
                  <div className="flex items-center justify-between bg-green-100 px-4 py-3 rounded-lg">
                    <span className="text-sm text-green-700">✅ 视频已配置</span>
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploading !== null}
                      className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                    >
                      替换视频
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept=".mp4,.mov,.webm,.avi,video/*"
                      onChange={handleVideoUpload}
                      disabled={uploading !== null}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 disabled:opacity-50"
                    />
                    <p className="text-xs text-slate-500 mt-2">上传正脸口型视频，5-60 秒</p>
                  </>
                )}
                {uploading === 'video' && (
                  <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                    <span className="animate-spin">⏳</span> 视频上传中...
                  </p>
                )}
              </div>

              {/* 隐藏的文件输入用于替换 */}
              <input
                ref={videoInputRef}
                type="file"
                accept=".mp4,.mov,.webm,.avi,video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />
            </div>
          )}

          {/* 生成按钮 - 只在未生成和未轮询时显示 */}
          {!finalVideoUrl && !isPolling && (
            <>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || !text.trim() || generating || uploading !== null}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> 提交中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🚀 立即生成数字人视频
                  </span>
                )}
              </Button>

              {!hasVideo && !loading && (
                <p className="text-xs text-center text-slate-400">
                  请先上传底板视频，即可使用系统音色生成
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
