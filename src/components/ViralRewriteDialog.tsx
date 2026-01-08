'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ChevronLeft, Loader } from 'lucide-react';
import { useAuth } from './auth/AuthWrapper';

interface ViralRewriteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shopProfile: any;
}

type Step = 'input' | 'transcribing' | 'result' | 'generating-rewrite';

export default function ViralRewriteDialog({
  isOpen,
  onClose,
  shopProfile,
}: ViralRewriteDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('input');
  const [videoUrl, setVideoUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [rewriteContent, setRewriteContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mp4Url, setMp4Url] = useState('');  // ✅ 保存 MP4 URL
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setVideoUrl('');
      setExtractedText('');
      setRewriteContent('');
      setError('');
      setMp4Url('');  // ✅ 也需要重置
    }
  }, [isOpen]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step, extractedText, rewriteContent]);

  // Step 1: 提取和转录视频
  const handleExtractAndTranscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl.trim()) {
      setError('请输入视频 URL');
      return;
    }

    setError('');
    setLoading(true);
    setStep('transcribing');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (user?.phone) {
        headers['x-user-phone'] = user.phone;
      }

      const response = await fetch('/api/parse-video', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          videoUrl,
          action: 'extract-and-transcribe',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提取和转录失败');
      }

      setExtractedText(data.extractedText);
      setMp4Url(data.mp4Url || data.videoUrl);  // ✅ 保存后端返回的 URL
      setStep('result');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '提取和转录失败，请检查视频 URL 是否正确';
      setError(errorMessage);
      // ❌ 不要改变上step，保持在转录阶段，且视频 URL 保留
      setStep('transcribing');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: 生成爆款仿写
  const handleGenerateRewrite = async () => {
    if (!extractedText.trim()) {
      setError('请先提取视频转录文本');
      return;
    }

    setError('');
    setLoading(true);
    setStep('generating-rewrite');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (user?.phone) {
        headers['x-user-phone'] = user.phone;
      }

      const response = await fetch('/api/parse-video', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'generate-rewrite',
          extractedText,
          shopProfile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.shouldShowUpgradeDialog) {
          throw new Error(
            `${data.error}

${data.message}

请前往"我的"页面兑换会员码升级为 VIP 会员。`
          );
        }
        throw new Error(data.error || '生成仿写内容失败');
      }

      setRewriteContent(data.content);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成仿写内容失败';
      setError(errorMessage);
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 复制内容逻辑 - 兼容非 HTTPS 环境
  const handleCopy = async () => {
    if (!rewriteContent) return;
    
    const btn = document.getElementById('copy-btn');
    
    try {
      // 方法1: 现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rewriteContent);
      } else {
        // 方法2: Fallback 用于非 HTTPS 环境
        const textArea = document.createElement('textarea');
        textArea.value = rewriteContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      // 成功反馈
      if (btn) {
        btn.textContent = '✅ 已复制';
        btn.style.background = '#dcfce7';
        btn.style.color = '#16a34a';
        btn.style.borderColor = '#bbf7d0';
        setTimeout(() => {
          btn.textContent = '📋 复制内容';
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 2000);
      }
    } catch (err) {
      console.error('复制失败:', err);
      if (btn) {
        btn.textContent = '❌ 复制失败';
        setTimeout(() => { btn.textContent = '📋 复制内容'; }, 2000);
      }
    }
  };

  // Step 1: 输入视频 URL
  if (step === 'input') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="fixed top-0 left-0 translate-x-0 translate-y-0 w-full h-[100dvh] m-0 p-0 rounded-none border-none bg-slate-50 flex flex-col shadow-none max-w-none z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
          onOpenAutoFocus={(e) => e.preventDefault()}
          showCloseButton={false}
          showOverlay={false}
        >
          {/* 顶部导航 */}
          <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20 pt-safe">
            <button
              onClick={onClose}
              className="w-10 h-10 -ml-2 flex items-center justify-center text-blue-600 active:opacity-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-[17px] font-semibold text-slate-900">爆款仿写</h2>
            <div className="w-10 h-10"></div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-auto px-4 py-6">
            <div className="max-w-md mx-auto space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">🎬 仿写爆款视频</h3>
                <p className="text-gray-500 text-sm mb-6">
                  输入抖音、小红书等视频链接，AI 帮你快速解析并生成适配你店铺的版本
                </p>

                <form onSubmit={handleExtractAndTranscribe} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                      视频链接 *
                    </label>
                    <Textarea
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="粘贴抖音、小红书、微博等视频链接"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      disabled={loading}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>正在解析视频...</span>
                      </>
                    ) : (
                      '🔍 解析视频'
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    ⏱️ 解析过程需要 5-15 秒，请耐心等待
                  </p>
                </form>
              </div>

              {!shopProfile && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">💡 未选择店铺档案</p>
                    <p>为获得针对性更强的仿写内容，建议先在"我的"页面添加店铺档案。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: 显示转录结果
  if (step === 'result' || step === 'generating-rewrite' || step === 'transcribing') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="fixed top-0 left-0 translate-x-0 translate-y-0 w-full h-[100dvh] m-0 p-0 rounded-none border-none bg-slate-50 flex flex-col shadow-none max-w-none z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
          onOpenAutoFocus={(e) => e.preventDefault()}
          showCloseButton={false}
          showOverlay={false}
        >
          {/* 顶部导航 */}
          <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20 pt-safe">
            <button
              onClick={() => setStep('input')}
              disabled={step === 'transcribing'}
              className="w-10 h-10 -ml-2 flex items-center justify-center text-blue-600 active:opacity-50 disabled:opacity-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-[17px] font-semibold text-slate-900">
              {step === 'transcribing' ? '正在解析...' : step === 'generating-rewrite' ? '正在生成...' : '转录完成'}
            </h2>
            <div className="w-10 h-10"></div>
          </div>

          {/* 内容区域 - ✅ 修复：不用 ScrollArea，直接用原生滚动 */}
          <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
            <div className="px-4 pt-4 pb-32 space-y-4">
                {/* 解析中的加载状态 */}
                {step === 'transcribing' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col items-center justify-center py-12">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                    <p className="text-gray-600 font-semibold">AI 正在解析视频...</p>
                    <p className="text-gray-400 text-sm mt-2">这可能需要 5-15 秒，请耐心等待</p>
                    <div className="mt-4 text-xs text-gray-400">
                      <p>✅ 步骤 1: 提取视频链接</p>
                      <p>✅ 步骤 2: 下载视频内容</p>
                      <p>🔄 步骤 3: AI 转录中...</p>
                    </div>
                  </div>
                )}

                {/* 显示转录文本 - ✅ 重构：取消内部高度限制，让父容器统一滚动 */}
                {extractedText && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3 text-base">📝 视频转录文本</h3>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {extractedText}
                    </p>
                  </div>
                )}

                {/* 显示仿写内容 - ✅ 重构：取消内部高度限制 */}
                {rewriteContent && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-base">
                      ✨ 爆款仿写结果
                      {step === 'generating-rewrite' && loading && (
                        <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse"></span>
                      )}
                    </h3>
                    <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: rewriteContent
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\n/g, '<br/>'),
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 生成中的加载状态 - ✅ Fix 2: 只有在没有内容时才显示大卡片 */}
                {step === 'generating-rewrite' && !rewriteContent && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col items-center justify-center py-12">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                    <p className="text-gray-600 font-semibold">AI 正在生成仿写内容...</p>
                    <p className="text-gray-400 text-sm mt-2">这可能需要 10-30 秒，请耐心等待</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col gap-3">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
                    </div>
                    {/* 错误时显示重试按钮 */}
                    {step === 'transcribing' && !loading && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setStep('input')}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm py-2"
                        >
                          ← 返回修改
                        </Button>
                        <Button
                          onClick={(e) => handleExtractAndTranscribe(e as React.FormEvent)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm py-2"
                        >
                          🔄 重试
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

          {/* 底部按钮 - 仅在 result 状态且无仿写内容时显示 */}
          {step === 'result' && !rewriteContent && !loading && (
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 py-3 pb-safe z-30 flex gap-3">
              <Button
                onClick={() => setStep('input')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
              >
                ← 重新输入
              </Button>
              <Button
                onClick={handleGenerateRewrite}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>✨ 生成仿写</>
                )}
              </Button>
            </div>
          )}

          {/* 完成按钮 - ✅ Fix 3: 不跳转，显示复制成功反馈 */}
          {rewriteContent && !loading && (
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-3 pb-safe z-30 flex gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0,05)]">
              <Button
                onClick={handleCopy}
                id="copy-btn"
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold h-12 transition-all"
              >
                📋 复制内容
              </Button>
              <Button
                onClick={() => {
                  setStep('input');
                  setExtractedText('');
                  setRewriteContent('');
                  setVideoUrl('');
                  setError('');
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold h-12 shadow-md shadow-blue-100"
              >
                🔄 再来一次
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
