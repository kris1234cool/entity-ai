'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface MemberActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (mobile: string, licenseKey: string) => Promise<void>;
  deviceId: string;
}

export default function MemberActivationModal({
  isOpen,
  onClose,
  onActivate,
  deviceId,
}: MemberActivationModalProps) {
  const [mobile, setMobile] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleActivate = async () => {
    // 验证输入
    if (!mobile.trim()) {
      setError('请输入手机号码');
      return;
    }
    if (!licenseKey.trim()) {
      setError('请输入卡密');
      return;
    }

    if (mobile.length !== 11 || !/^\d+$/.test(mobile)) {
      setError('请输入正确的 11 位手机号');
      return;
    }

    if (licenseKey.length < 6) {
      setError('卡密格式不正确');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onActivate(mobile, licenseKey);
      // 激活成功，关闭 modal 并重置表单
      setMobile('');
      setLicenseKey('');
      onClose();
    } catch (err: any) {
      setError(err.message || '激活失败，请检查卡密是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleActivate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md p-6 rounded-lg shadow-lg z-50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">激活会员</DialogTitle>
          <DialogDescription className="text-sm text-slate-600 mt-2">
            输入手机号码和卡密即可获得无限生成权限
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">🎯 您的免费额度已用尽</p>
              <p>输入卡密可立即升级为会员，享受无限生成次数！</p>
            </div>
          </div>

          {/* 手机号输入 */}
          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-slate-700 font-medium">
              手机号
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center justify-center bg-slate-100 border border-slate-300 rounded-md px-3 text-slate-700 text-sm font-medium">
                +86
              </div>
              <Input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="请输入 11 位手机号"
                maxLength={11}
                className="flex-1 bg-white border border-slate-300"
                disabled={loading}
              />
            </div>
          </div>

          {/* 卡密输入 */}
          <div className="space-y-2">
            <Label htmlFor="licenseKey" className="text-slate-700 font-medium">
              卡密 (License Key)
            </Label>
            <Input
              id="licenseKey"
              type="text"
              value={licenseKey}
              onChange={(e) => {
                setLicenseKey(e.target.value.trim().toUpperCase());
                setError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="请输入您的卡密"
              className="bg-white border border-slate-300"
              disabled={loading}
            />
            <p className="text-xs text-slate-500">
              没有卡密？<a href="#" className="text-blue-600 hover:underline">立即购买</a>
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="flex-1 text-slate-700"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleActivate}
            disabled={loading || !mobile || !licenseKey}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold"
          >
            {loading ? '激活中...' : '立即激活'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
