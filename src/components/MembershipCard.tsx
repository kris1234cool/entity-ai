'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserProfile } from '@/types';
import { Crown, Zap } from 'lucide-react';
import { getOrCreateDeviceId, saveLicenseInfo } from '@/lib/device-utils';

interface MembershipCardProps {
  profile: UserProfile | null;
  onRedeemSuccess: () => void;
}

export default function MembershipCard({ profile, onRedeemSuccess }: MembershipCardProps) {
  const [redeemCode, setRedeemCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
  }, []);

  const isMember = profile?.membership_level === 'premium' || profile?.membership_level === 'enterprise';
  const expiryDate = profile?.membership_expire_at
    ? new Date(profile.membership_expire_at)
    : null;
  const isExpired = expiryDate && expiryDate < new Date();

  const handleRedeem = async () => {
    // 验证输入
    if (!redeemCode.trim()) {
      setError('请输入卡密');
      return;
    }

    if (mobile && (mobile.length !== 11 || !/^\d+$/.test(mobile))) {
      setError('请输入正确的 11 位手机号');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: redeemCode,
          mobile: mobile || profile?.phone?.replace(/^\+86/, '') || '',
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '兑换失败，请重试');
        return;
      }

      // 如果是未登录用户，保存到本地存储
      if (!profile) {
        saveLicenseInfo({
          membershipLevel: data.license.membership_level,
          expiresAt: data.license.expires_at,
          mobile: mobile || '',
          code: redeemCode,
        });
      }

      setSuccess(data.message || '兑换成功！');
      setRedeemCode('');
      
      // 延迟关闭和回调
      setTimeout(() => {
        setIsOpen(false);
        onRedeemSuccess();
      }, 1500);
    } catch (err) {
      setError('网络错误，请重试');
      console.error('兑换失败:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* 会员卡 */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-lg mb-6 ${
          isMember && !isExpired
            ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500'
            : 'bg-gradient-to-br from-slate-400 to-slate-600'
        }`}
      >
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wider">
                {isMember && !isExpired ? 'VIP 会员' : '普通用户'}
              </span>
            </div>
            {isMember && !isExpired && (
              <div className="bg-white/30 backdrop-blur px-3 py-1 rounded-full text-xs">
                Premium
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-xs opacity-80 mb-1">会员等级</p>
            <h3 className="text-2xl font-bold">
              {isMember && !isExpired ? 'VIP' : 'FREE'}
            </h3>
          </div>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs opacity-80 mb-1">有效期至</p>
              <p className="font-mono text-sm font-bold">
                {expiryDate
                  ? expiryDate.toLocaleDateString('zh-CN')
                  : '未设置'}
              </p>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white/30 hover:bg-white/40 text-white backdrop-blur px-4 py-2 rounded-xl text-sm font-medium">
                  兑换会员
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-800">兑换会员</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {error && (
                    <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      {success}
                    </div>
                  )}

                  {!success && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          卡密
                        </label>
                        <Input
                          value={redeemCode}
                          onChange={(e) => {
                            setRedeemCode(e.target.value.toUpperCase());
                            setError('');
                          }}
                          placeholder="例如: PREM2024001"
                          className="bg-white/80 border-white/40 rounded-2xl text-slate-900 placeholder:text-slate-400"
                          disabled={loading}
                        />
                      </div>

                      {!profile && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            手机号 (可选)
                          </label>
                          <div className="flex gap-2">
                            <div className="flex items-center justify-center bg-slate-100 border border-slate-300 rounded-2xl px-3 text-slate-700 text-sm font-medium">
                              +86
                            </div>
                            <Input
                              value={mobile}
                              onChange={(e) => {
                                setMobile(e.target.value.replace(/[^0-9]/g, ''));
                                setError('');
                              }}
                              placeholder="输入 11 位手机号"
                              maxLength={11}
                              className="flex-1 bg-white/80 border-white/40 rounded-2xl text-slate-900 placeholder:text-slate-400"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleRedeem}
                        disabled={loading || !redeemCode.trim()}
                        className="w-full bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-2xl py-3 disabled:opacity-50"
                      >
                        {loading ? '兑换中...' : '立即兑换'}
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* 会员期限提示 */}
      {isMember && isExpired && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg text-sm mb-6">
          <p className="font-semibold mb-1">⚠️ 会员已过期</p>
          <p>您的会员权益已失效，请重新兑换卡密以续期。</p>
        </div>
      )}
    </div>
  );
}
