'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScriptResult, IdeasResult } from '@/types';
import ScriptCard from './ScriptCard';

interface ScriptGeneratorProps {
  shopProfile: any;
}

type Step = 'idle' | 'ideas_generated' | 'script_generated';

interface AmmoBox {
  type: string;
  hooks: string[];
}

export default function ScriptGenerator({ shopProfile }: ScriptGeneratorProps) {
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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      const result: IdeasResult = await response.json();
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
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      const result = await response.json();
      setGeneratedScript(result);
      setStep('script_generated');
    } catch (error) {
      console.error('生成脚本时出错:', error);
      alert('生成脚本时出现错误，请稍后重试');
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
  };

  // Step 1: 输入行业和地点
  if (step === 'idle') {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">💥 灵感一闪</CardTitle>
            <CardDescription className="text-gray-400">
              输入你的行业和地点，AI 帮你快速生成 4 组爆款最帕
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerateIdeas} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="industry" className="text-white">
                    行业领域 *
                  </Label>
                  <Input
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="例如：美发、护肤、餐饮"
                    className="bg-gray-800 border-gray-700 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-white">
                    地理位置 *
                  </Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="例如：上海、浙江、北京"
                    className="bg-gray-800 border-gray-700 text-white"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-6 text-lg"
              >
                {loading ? '🤖 AI 正在炸灵感...' : '💥 炸出灵感'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: 显示 Ideas 和可点击的 Hooks
  if (step === 'ideas_generated' && ideas) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* 显示 AI 回复 */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">💬 老板的回复</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-200 text-lg mb-6">{ideas.reply}</p>

            {/* 显示 Ammo Boxes */}
            <div className="space-y-6">
              {ideas.ammo_boxes.map((box: AmmoBox, boxIndex: number) => (
                <div key={boxIndex} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-yellow-400 mb-4">{box.type}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {box.hooks.map((hook: string, hookIndex: number) => (
                      <button
                        key={hookIndex}
                        onClick={() => handleHookClick(hook)}
                        disabled={loading}
                        className="p-4 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg active:scale-95 text-sm"
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
            </div>

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full mt-8 text-gray-300 border-gray-600"
            >
              ← 返回重新输入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: 显示生成的脚本
  if (step === 'script_generated' && generatedScript) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">🎬 编导完成</CardTitle>
            <CardDescription className="text-gray-400">
              选中的最帕: {selectedHook}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 显示 Markdown 表格内容 */}
            <div className="bg-gray-800 rounded-lg p-6 text-gray-200 overflow-x-auto text-sm">
              <div className="whitespace-pre-wrap font-mono">{generatedScript.content}</div>
            </div>

            <div className="flex gap-4 mt-8">
              <Button
                onClick={() => setStep('ideas_generated')}
                variant="outline"
                className="flex-1 text-gray-300 border-gray-600"
              >
                ← 返回选择其他最帕
              </Button>
              <Button
                onClick={handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                🔄 重新开始
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
