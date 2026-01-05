'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'INPUT_PHONE' | 'INPUT_OTP'>('INPUT_PHONE');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleGetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 11) {
      alert('请输入正确的 11 位手机号');
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: '+86' + phone,
      });

      if (error) throw error;
      
      setStep('INPUT_OTP');
    } catch (error: any) {
      console.error('获取验证码失败:', error);
      alert(error.message || '获取验证码失败，请检查手机号是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      alert('请输入 6 位验证码');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: '+86' + phone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      // 登录成功，跳转到主页（layout 会自动处理权限重定向）
      router.push('/dashboard');
      router.refresh();
    } catch (error: any) {
      console.error('验证失败:', error);
      alert(error.message || '验证码错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">
            {step === 'INPUT_PHONE' ? '登录' : '验证验证码'}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {step === 'INPUT_PHONE' 
              ? '请输入您的手机号码以继续' 
              : `验证码已发送至 +86 ${phone}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'INPUT_PHONE' ? (
            <form onSubmit={handleGetCode} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">手机号</Label>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center bg-gray-800 border border-gray-700 rounded-md px-3 text-white text-sm font-medium">
                    +86
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="请输入手机号码"
                    className="bg-gray-800 border-gray-700 text-white flex-1"
                    required
                    maxLength={11}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading || phone.length !== 11}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-6 text-lg"
              >
                {loading ? '发送中...' : '获取验证码'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-white">验证码</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="请输入 6 位验证码"
                  className="bg-gray-800 border-gray-700 text-white text-center tracking-[0.5em] text-xl font-bold"
                  required
                  maxLength={6}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  type="submit" 
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-6 text-lg"
                >
                  {loading ? '验证中...' : '立即登录'}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('INPUT_PHONE')}
                  className="text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  返回修改手机号
                </Button>
              </div>
            </form>
          )}
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>点击登录即表示您同意我们的服务条款和隐私政策</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}