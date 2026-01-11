'use client';

import { useState } from 'react';
import { ScriptResult, IdeasResult } from '@/types';
import { useAuth } from './auth/AuthWrapper';

interface ScriptGeneratorProps {
  shopProfile: any;
  onClose?: () => void;
}

type Step = 'idle' | 'ideas_generated' | 'script_generated';

interface AmmoBox {
  type: string;
  hooks: string[];
}

export default function ScriptGenerator({ shopProfile, onClose }: ScriptGeneratorProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [selectedHook, setSelectedHook] = useState('');
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<IdeasResult | null>(null);
  const [generatedScript, setGeneratedScript] = useState<any>(null);

  // Step 1: 生成 Ideas
  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim() || !location.trim()) {
      alert('请输入行业和地点');
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 传递用户手机号
      if (user?.phone) {
        headers['x-user-phone'] = user.phone;
      }
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          step: 'ideas',
          industry,
          location,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成灵感失败');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      let accumulated = '';
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value);
      }

      const result: IdeasResult = JSON.parse(accumulated);
      setIdeas(result);
      setStep('ideas_generated');
    } catch (error) {
      console.error('生成灵感时出错:', error);
      alert(error instanceof Error ? error.message : '生成灵感时出现错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: 点击 hook 按钮生成脚本
  const handleHookClick = async (hook: string) => {
    setSelectedHook(hook);
    setLoading(true);
    setGeneratedScript({ content: '' }); // 初始化为空，准备接收流
    setStep('script_generated'); // 立即切换到显示页面，看到打字机效果

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 传递用户手机号
      if (user?.phone) {
        headers['x-user-phone'] = user.phone;
      }
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          step: 'script',
          industry,
          location,
          selected_hook: hook,
        }),
      });

      if (!response.ok) {
        throw new Error(`脚本生成失败: ${response.statusText}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullContent += chunk;
        setGeneratedScript({ content: fullContent });
      }
    } catch (error) {
      console.error('生成脚本时出错:', error);
      alert('生成脚本时出现错误，请稍后重试');
      setStep('ideas_generated'); // 失败则退回
    } finally {
      setLoading(false);
    }
  };

  // 重置回到第一步
  const handleReset = () => {
    setStep('idle');
    setIndustry('');
    setLocation('');
    setSelectedHook('');
    setIdeas(null);
    setGeneratedScript(null);
    onClose?.();
  };

  // 关闭对话框
  const handleClose = () => {
    onClose?.();
  };

  // Step 1: 输入行业和地点
  if (step === 'idle') {
    return (
      <div className="w-full h-full flex flex-col bg-gray-50">
        {/* 顶部导航栏 */}
        <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20 pt-safe">
          <button
            onClick={handleClose}
            className="w-10 h-10 -ml-2 flex items-center justify-center text-gray-500 active:opacity-50"
          >
            ✕
          </button>
          <h2 className="text-[17px] font-semibold text-slate-900">灵感一闪</h2>
          <div className="w-10 h-10"></div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">💥 炸出灵感</h3>
              <p className="text-gray-500 text-sm mb-6">
                输入你的行业和地点，AI 帮你快速生成 4 组爆款最帕
              </p>

              <form onSubmit={handleGenerateIdeas} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    行业领域 *
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="例如：美发、护肤、餐饮"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    地理位置 *
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="例如：上海、浙江、北京"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                  {loading ? '🤖 AI 正在炸灵感...' : '💥 炸出灵感'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: 显示 Ideas 和可点击的 Hooks
  if (step === 'ideas_generated' && ideas) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-50">
        {/* 顶部导航栏 */}
        <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20 pt-safe">
          <button
            onClick={() => setStep('idle')}
            className="w-10 h-10 -ml-2 flex items-center justify-center text-blue-600 active:opacity-50 text-lg"
          >
            ←
          </button>
          <h2 className="text-[17px] font-semibold text-slate-900">选择最帕</h2>
          <div className="w-10 h-10"></div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="max-w-md mx-auto space-y-6">
            {/* 显示 AI 回复 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <p className="text-gray-800 text-lg">{ideas.reply}</p>
            </div>

            {/* 显示 Ammo Boxes */}
            {ideas.ammo_boxes.map((box: AmmoBox, boxIndex: number) => (
              <div key={boxIndex} className="bg-white rounded-2xl p-6 border border-gray-200 space-y-3">
                <h3 className="text-base font-bold text-amber-600">{box.type}</h3>
                <div className="space-y-2">
                  {box.hooks.map((hook: string, hookIndex: number) => (
                    <button
                      key={hookIndex}
                      onClick={() => handleHookClick(hook)}
                      disabled={loading}
                      className="w-full p-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all active:scale-95 text-sm text-left"
                    >
                      {loading && selectedHook === hook ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⏳</span>
                          导演中...
                        </span>
                      ) : (
                        hook
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* 返回按钮 */}
            <button
              onClick={() => setStep('idle')}
              className="w-full p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
            >
              ← 返回重新输入
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: 显示生成的脚本
  if (step === 'script_generated' && generatedScript) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-50">
        {/* 顶部导航栏 */}
        <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20 pt-safe">
          <button
            onClick={() => setStep('ideas_generated')}
            className="w-10 h-10 -ml-2 flex items-center justify-center text-blue-600 active:opacity-50 text-lg"
          >
            ←
          </button>
          <h2 className="text-[17px] font-semibold text-slate-900">编导完成</h2>
          <div className="w-10 h-10"></div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              <p>选中的最帕: <span className="font-semibold text-gray-900">{selectedHook}</span></p>
            </div>

            {/* 显示 Markdown 表格内容 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 overflow-x-auto">
              <div className="whitespace-pre-wrap font-mono text-xs text-gray-800 leading-relaxed">
                {generatedScript.content}
              </div>
            </div>

            {/* 导航按钮 */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('ideas_generated')}
                className="flex-1 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
              >
                ← 其他最帕
              </button>
              <button
                onClick={handleClose}
                className="flex-1 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                ✓ 完成
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
