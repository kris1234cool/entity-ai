'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthWrapper';
import { Button } from '@/components/ui/button';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // 已登录，重定向到 dashboard
      router.push('/dashboard');
    }
    // 未登录用户保持在首页 - 允许试用
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 已登录用户会自动跳转到 dashboard，所以这里只显示给未登录用户
  if (user) {
    return null;
  }

  // 未登录用户显示首页欢迎界面
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">✨</div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          AI 文案助手
        </h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          为实体店老板量身定制的短视频脚本生成工具。试用免费，无需登录。
        </p>

        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
            <span>免费试用 5 次生成</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
            <span>无需复杂注册，立即开始</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
            <span>卡密激活即可无限使用</span>
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-full transition-all mb-4 shadow-md"
        >
          立即开始 (免费试用)
        </button>

        <button
          onClick={() => router.push('/profile')}
          className="w-full bg-white border-2 border-slate-300 text-slate-900 font-semibold py-3 px-6 rounded-full hover:bg-slate-50 transition-all"
        >
          已有卡密？立即激活
        </button>
      </div>
    </div>
  );
}