'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScriptResult, ScriptSegment } from '@/types';
import { Download, Share2, Copy } from 'lucide-react';
import { useState } from 'react';

interface ScriptCardProps {
  script: ScriptResult;
}

export default function ScriptCard({ script }: ScriptCardProps) {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateImage = () => {
    setIsGeneratingImage(true);
    // 模拟图片生成过程
    setTimeout(() => {
      setIsGeneratingImage(false);
      alert('图片已生成，功能待实现');
    }, 1500);
  };

  const handleCopyScript = () => {
    const scriptText = script.script_list.map((seg, index) => 
      `${index + 1}. 画面: ${seg.visual}\n   台词: ${seg.audio}\n   情绪: ${seg.emotion}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(scriptText);
    alert('脚本已复制到剪贴板');
  };

  return (
    <Card className="w-full bg-white/40 backdrop-blur-2xl border border-white/60 overflow-hidden rounded-[32px] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
      <CardHeader className="bg-white/40 backdrop-blur-md border-b border-white/40 px-5 py-4">
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-4">
            <CardTitle className="text-[17px] font-bold text-slate-900 tracking-tight leading-tight">{script.title}</CardTitle>
            <p className="text-slate-500 text-[12px] mt-1 font-medium leading-tight opacity-80">{script.cover_text}</p>
          </div>
          <div className="flex space-x-2 flex-shrink-0">
            <Button 
              size="sm" 
              onClick={handleCopyScript}
              className="bg-white/60 backdrop-blur-md border border-white/80 text-slate-700 hover:bg-white/90 shadow-sm rounded-full px-4 h-8 text-[12px] font-semibold transition-all active:scale-[0.95]"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              复制
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse">
            <thead className="bg-white/20">
              <tr>
                <th className="text-left py-3 px-4 text-slate-500 font-bold text-[11px] uppercase tracking-wider w-12">#</th>
                <th className="text-left py-3 px-4 text-slate-500 font-bold text-[11px] uppercase tracking-wider">画面</th>
                <th className="text-left py-3 px-4 text-slate-500 font-bold text-[11px] uppercase tracking-wider">台词</th>
              </tr>
            </thead>
            <tbody>
              {script.script_list.map((segment: ScriptSegment, index: number) => (
                <tr 
                  key={index} 
                  className={`border-b border-white/20 last:border-0 ${index % 2 === 0 ? 'bg-white/10' : 'bg-transparent'}`}
                >
                  <td className="py-4 px-4 text-slate-400 text-[13px] font-medium align-top">{index + 1}</td>
                  <td className="py-4 px-4 text-slate-800 text-[14px] leading-relaxed align-top font-medium">{segment.visual}</td>
                  <td className="py-4 px-4 text-slate-900 text-[14px] leading-relaxed align-top">
                    <div className="bg-white/40 backdrop-blur-sm rounded-2xl px-3 py-2 border border-white/40">
                      {segment.audio}
                    </div>
                    {segment.emotion && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">
                        {segment.emotion}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-white/30 flex justify-between items-center">
          <Button 
            variant="ghost"
            className="text-slate-500 hover:text-slate-800 text-[12px] font-bold transition-colors"
          >
            <Share2 className="h-4 w-4 mr-2" />
            分享
          </Button>
          <Button 
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            className="bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-md rounded-full px-6 h-9 text-[13px] font-bold transition-all active:scale-[0.95] disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGeneratingImage ? '正在生成...' : '生成图片'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}