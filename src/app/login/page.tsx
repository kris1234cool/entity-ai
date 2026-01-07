'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthWrapper';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 11) {
      alert('请输入正确的 11 位手机号');
      return;
    }
    
    setLoading(true);

    try {
      // 线索收集模式：直接保存手机号并模拟登录
      signIn(phone);
      
      // 跳转到主页
      router.push('/');
    } catch (error: any) {
      console.error('登录失败:', error);
      alert('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">登录</CardTitle>
          <CardDescription className="text-gray-400">
            请输入您的手机号码以继续
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
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
              {loading ? '登录中...' : '立即登录'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>点击登录即表示您同意我们的服务条款和隐私政策</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}