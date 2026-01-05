'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthWrapper';
import MemberActivationModal from '@/components/MemberActivationModal';
import { getOrCreateDeviceId, saveLicenseInfo } from '@/lib/device-utils';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    // 初始化设备 ID
    const id = getOrCreateDeviceId();
    setDeviceId(id);

    // 如果已登录，重定向到 dashboard
    if (!loading && user) {
      router.push('/dashboard');
    }
    // 如果未登录，保持在首页 - 允许未认证用户访问
  }, [user, loading, router]);

  const handleActivate = async (mobile: string, licenseKey: string) => {
    setIsActivating(true);
    try {
      const response = await fetch('/api/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile,
          code: licenseKey,
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '激活失败');
      }

      // 保存许可证信息到本地存储
      saveLicenseInfo({
        membershipLevel: data.license.membership_level,
        expiresAt: data.license.expires_at,
        mobile,
        code: licenseKey,
      });

      // 激活成功，关闭 modal，继续使用
      setShowActivationModal(false);
    } catch (error: any) {
      throw new Error(error.message || '激活失败，请检查卡密是否正确');
    } finally {
      setIsActivating(false);
    }
  };

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

  // 如果已登录，会在 useEffect 中重定向到 dashboard
  if (user) {
    return null;
  }

  // 未登录的用户：显示首页内容
  return (
    <>
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
            onClick={() => setShowActivationModal(true)}
            className="w-full bg-white border-2 border-slate-300 text-slate-900 font-semibold py-3 px-6 rounded-full hover:bg-slate-50 transition-all"
          >
            已有卡密？立即激活
          </button>
        </div>
      </div>

      {/* 成员激活 Modal */}
      <MemberActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        onActivate={handleActivate}
        deviceId={deviceId}
      />
    </>
  );
}