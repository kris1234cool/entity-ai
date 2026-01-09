'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import AgentChatDialog from '@/components/AgentChatDialog';
import ScriptGenerator from '@/components/ScriptGenerator';
import ViralRewriteDialog from '@/components/ViralRewriteDialog';
import DigitalHumanDialog from '@/components/DigitalHumanDialog';
import { useAuth } from '@/components/auth/AuthWrapper';
import { useProject } from '@/contexts/ProjectContext';
import { useRouter } from 'next/navigation';
import { ScriptType } from '@/types';
import { AGENT_CONFIG } from '@/lib/agent-config';

export default function Dashboard() {
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDigitalHumanOpen, setIsDigitalHumanOpen] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const { activeProject, loading: projectLoading } = useProject();
  const router = useRouter();

  // 检查用户是否为 VIP 会员（根据数据库中的会员等级和过期时间）
  const isVipMember = () => {
    if (!profile) return false;
    if (profile.membership_level !== 'premium' && profile.membership_level !== 'enterprise') return false;
    if (!profile.membership_expire_at) return false;
    return new Date(profile.membership_expire_at) > new Date();
  };

  // VIP 用户解锁所有功能，免费用户只能用第一个
  const lockedScriptTypes = isVipMember() ? [] : ['进店理由', '观点输出', '口播', '爆款选题', '爆款仿写'];

  const handleScriptTypeClick = (scriptType: ScriptType) => {
    // 检查是否是锁定的脚本类型
    if (lockedScriptTypes.includes(scriptType)) {
      alert('请解锁 VIP 畷享全能导演模式！');
      return;
    }
  
    // 灵感一闪特殊处理：不需要店铺档案
    if (scriptType === '✨ 灵感一闪') {
      setSelectedScriptType(scriptType);
      setIsDialogOpen(true);
      return;
    }
  
    if (!activeProject) {
      // 如果没有活跳档案，提示用户先创建
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
              {Object.entries(AGENT_CONFIG).map(([scriptType, config], index) => {
                const isLocked = lockedScriptTypes.includes(scriptType as ScriptType);
                const isFirstOption = index === 0;
                
                return (
                  <button
                    key={config.id}
                    onClick={() => handleScriptTypeClick(scriptType as ScriptType)}
                    disabled={isLocked}
                    className={`relative backdrop-blur-xl border shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] transition-all duration-500 rounded-[28px] py-4 px-5 text-left group active:scale-[0.97] ${
                      isFirstOption
                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-yellow-300/50 hover:border-yellow-400 hover:shadow-[0_8px_32px_0_rgba(180,83,9,0.15)]'
                        : isLocked
                        ? 'bg-gray-100/50 border-gray-200/50 opacity-60 cursor-not-allowed'
                        : 'bg-white/40 border-white/60 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Glass Circle Icon */}
                        <div className={`w-11 h-11 rounded-2xl backdrop-blur-md border flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform flex-shrink-0 ${
                          isFirstOption
                            ? 'bg-yellow-100/60 border-yellow-300/80'
                            : isLocked
                            ? 'bg-gray-200/60 border-gray-300/50'
                            : 'bg-white/60 border-white/80'
                        }`}>
                          {config.icon}
                        </div>
                        {/* Title + Subtitle */}
                        <div>
                          <h4 className={`font-bold text-[16px] mb-0.5 tracking-tight ${
                            isFirstOption
                              ? 'text-amber-900'
                              : isLocked
                              ? 'text-gray-500'
                              : 'text-slate-900'
                          }`}>{scriptType}</h4>
                          <p className={`text-[12px] font-medium leading-tight opacity-80 ${
                            isFirstOption
                              ? 'text-amber-700'
                              : isLocked
                              ? 'text-gray-400'
                              : 'text-slate-500'
                          }`}>{config.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Lock Icon for Locked Options */}
                        {isLocked && (
                          <div className="text-xl text-red-500">🔒</div>
                        )}
                        {/* Arrow Icon for Unlocked Options */}
                        {!isLocked && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            isFirstOption
                              ? 'bg-yellow-100/60 opacity-100'
                              : 'bg-white/40 opacity-0 group-hover:opacity-100'
                          } transition-opacity`}>
                            <svg className={`w-4 h-4 ${
                              isFirstOption ? 'text-amber-600' : 'text-slate-400'
                            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 灵感一闪 - 2 步流程 */}
            {selectedScriptType === '✨ 灵感一闪' && (
              <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
                <DialogContent className="fixed top-0 left-0 translate-x-0 translate-y-0 w-full h-[100dvh] m-0 p-0 rounded-none border-none bg-slate-50 flex flex-col shadow-none max-w-none z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right">
                  <ScriptGenerator shopProfile={activeProject} onClose={handleCloseDialog} />
                </DialogContent>
              </Dialog>
            )}

            {/* 一键数字人视频按钮 */}
            <div className="mt-6">
              <button
                onClick={() => setIsDigitalHumanOpen(true)}
                className="w-full relative backdrop-blur-xl border shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] transition-all duration-500 rounded-[28px] py-4 px-5 text-left group active:scale-[0.97] bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300/50 hover:border-cyan-400 hover:shadow-[0_8px_32px_0_rgba(6,182,212,0.15)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl backdrop-blur-md border bg-cyan-100/60 border-cyan-300/80 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform flex-shrink-0">
                      🎬
                    </div>
                    <div>
                      <h4 className="font-bold text-[16px] mb-0.5 tracking-tight text-cyan-900">一键数字人视频</h4>
                      <p className="text-[12px] font-medium leading-tight opacity-80 text-cyan-700">将文案转为数字人口播视频</p>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-cyan-100/60 opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
            
            {/* 数字人对话框 */}
            <DigitalHumanDialog
              isOpen={isDigitalHumanOpen}
              onClose={() => setIsDigitalHumanOpen(false)}
              userId={user?.id || 'anonymous'}
            />
            
            {/* 爆款仿写 - 特殊处理 */}
            {selectedScriptType === '爆款仿写' && (
              <ViralRewriteDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                shopProfile={activeProject}
              />
            )}

            {/* 其他脚本类型 - Agent 对话框 */}
            {selectedScriptType && selectedScriptType !== '✨ 灵感一闪' && selectedScriptType !== '爆款仿写' && (
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