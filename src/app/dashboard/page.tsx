'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import AgentChatDialog from '@/components/AgentChatDialog';
import { useAuth } from '@/components/auth/AuthWrapper';
import { useProject } from '@/contexts/ProjectContext';
import { useRouter } from 'next/navigation';
import { ScriptType } from '@/types';
import { AGENT_CONFIG } from '@/lib/agent-config';

export default function Dashboard() {
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { activeProject, loading: projectLoading } = useProject();
  const router = useRouter();

  const handleScriptTypeClick = (scriptType: ScriptType) => {
    if (!activeProject) {
      // 如果没有活跃档案，提示用户先创建
      alert('请先在"我的"页面创建或选择一个店铺档案');
      router.push('/profile');
      return;
    }
    setSelectedScriptType(scriptType);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedScriptType(null);
  };

  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Glassmorphism Header */}
      <header className="sticky top-0 z-10 bg-white/60 backdrop-blur-xl border-b border-white/40 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            AI文案助手
          </h1>
          {activeProject && (
            <div className="text-xs bg-blue-600/20 text-blue-600 px-3 py-1 rounded-full">
              {activeProject.shop_name}
            </div>
          )}
        </div>
      </header>

      <main className="px-6 py-8">
        {!activeProject ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">还未选择店铺档案</h2>
            <p className="text-slate-500 mb-6">请先在"我的"页面创建或选择一个档案，这样AI就能为你生成更精准的内容</p>
            <Button
              onClick={() => router.push('/profile')}
              className="bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-full px-6"
            >
              立即创建档案
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4">选择脚本类型</h2>
            </div>
            
            {/* Vertical Stack Layout - One Card Per Row */}
            <div className="flex flex-col gap-3">
              {Object.entries(AGENT_CONFIG).map(([scriptType, config]) => (
                <button
                  key={config.id}
                  onClick={() => handleScriptTypeClick(scriptType as ScriptType)}
                  className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] transition-all duration-500 rounded-[28px] py-4 px-5 text-left group active:scale-[0.97]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Glass Circle Icon */}
                      <div className="w-11 h-11 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform flex-shrink-0">
                        {config.icon}
                      </div>
                      {/* Title + Subtitle */}
                      <div>
                        <h4 className="font-bold text-slate-900 text-[16px] mb-0.5 tracking-tight">{scriptType}</h4>
                        <p className="text-[12px] text-slate-500 font-medium leading-tight opacity-80">{config.description}</p>
                      </div>
                    </div>
                    {/* Arrow Icon */}
                    <div className="w-7 h-7 rounded-full bg-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Agent 对话框 */}
            {selectedScriptType && (
              <AgentChatDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                scriptType={selectedScriptType}
                shopProfile={activeProject}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
