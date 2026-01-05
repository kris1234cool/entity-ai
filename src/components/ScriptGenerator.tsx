'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScriptType, ConversionGoal } from '@/types';
import ScriptCard from './ScriptCard';

interface ScriptGeneratorProps {
  shopProfile: any;
}

export default function ScriptGenerator({ shopProfile }: ScriptGeneratorProps) {
  const [scriptType, setScriptType] = useState<ScriptType>('人设故事');
  const [conversionGoal, setConversionGoal] = useState<ConversionGoal>('涨粉');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<any>(null);

  const scriptTypes: ScriptType[] = ['人设故事', '进店理由', '观点输出', '口播', '爆款选题', '爆款仿写'];
  const conversionGoals: ConversionGoal[] = ['涨粉', '卖货', '信任'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      alert('请输入主题关键词');
      return;
    }

    setLoading(true);
    
    try {
      // 调用 API 生成脚本
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scriptType,
          conversionGoal,
          topic,
          shopProfile,
        }),
      });

      if (!response.ok) {
        throw new Error(`生成失败: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedScript(result);
    } catch (error) {
      console.error('生成脚本时出错:', error);
      alert('生成脚本时出现错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl text-white">AI 脚本生成器</CardTitle>
          <CardDescription className="text-gray-400">
            选择脚本类型和转化目标，输入主题关键词生成专业短视频脚本
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-white">脚本类型</Label>
                <Select value={scriptType} onValueChange={(value: ScriptType) => setScriptType(value)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {scriptTypes.map(type => (
                      <SelectItem key={type} value={type} className="text-white focus:bg-gray-700">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">转化目标</Label>
                <Select value={conversionGoal} onValueChange={(value: ConversionGoal) => setConversionGoal(value)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {conversionGoals.map(goal => (
                      <SelectItem key={goal} value={goal} className="text-white focus:bg-gray-700">
                        {goal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic" className="text-white">主题关键词</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：夏日清爽发型、秋季护肤秘诀、冬季保暖穿搭"
                className="bg-gray-800 border-gray-700 text-white"
                required
              />
              <p className="text-sm text-gray-400 mt-1">
                基于您的店铺档案: {shopProfile?.shop_name} ({shopProfile?.category})
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-6 text-lg"
            >
              {loading ? 'AI 正在创作中...' : '生成脚本'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {generatedScript && (
        <div className="mt-8">
          <ScriptCard script={generatedScript} />
        </div>
      )}
    </div>
  );
}