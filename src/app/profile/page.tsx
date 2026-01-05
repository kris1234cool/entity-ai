'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthWrapper';
import { useProject } from '@/contexts/ProjectContext';
import { ShopProfile } from '@/types';
import { Trash2, Plus, Check, LogIn } from 'lucide-react';
import MembershipCard from '@/components/MembershipCard';
import { getLicenseInfo, getTodayGenerationCount } from '@/lib/device-utils';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const { projects, activeProject, setActiveProject, addProject, deleteProject } = useProject();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    shop_name: '',
    category: '',
    target_audience: '',
    unique_selling_point: '',
    boss_persona: '',
  });
  const [loading, setLoading] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const router = useRouter();

  // 获取本地许可证信息
  useEffect(() => {
    const info = getLicenseInfo();
    setLicenseInfo(info);
  }, [refreshKey]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddProject = async () => {
    if (!formData.shop_name.trim()) {
      alert('请填写店铺名称');
      return;
    }

    setLoading(true);
    try {
      await addProject({
        user_id: user?.id || '',
        ...formData,
      } as ShopProfile);
      
      // 重置表单
      setFormData({
        shop_name: '',
        category: '',
        target_audience: '',
        unique_selling_point: '',
        boss_persona: '',
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('添加档案失败:', error);
      alert('添加档案失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string | undefined) => {
    if (!id) return;
    
    if (confirm('确定删除这个档案吗？')) {
      try {
        await deleteProject(id);
      } catch (error) {
        console.error('删除档案失败:', error);
        alert('删除档案失败，请重试');
      }
    }
  };

  const handleSignOut = async () => {
    if (confirm('确定要退出登录吗？')) {
      await signOut();
      window.location.href = '/login';
    }
  };

  // 未登录用户显示简化版本（可以兑换卡密）
  if (!user) {
    return (
      <div className="pb-8 space-y-6">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/60 backdrop-blur-xl border-b border-white/40 p-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            我的
          </h1>
        </header>

        <main className="px-6 space-y-8">
          {/* 会员卡 - 未登录用户也可以兑换卡密 */}
          <MembershipCard 
            profile={null} 
            onRedeemSuccess={() => {
              setRefreshKey(prev => prev + 1);
            }}
          />

          {/* 本地许可证信息 */}
          {licenseInfo && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">激活信息</h2>
              <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-4 space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">会员等级</Label>
                  <p className="text-slate-800 font-medium">
                    {licenseInfo.membershipLevel === 'premium' ? '高级会员' : '企业会员'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">有效期至</Label>
                  <p className="text-slate-800 font-medium">
                    {new Date(licenseInfo.expiresAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                {licenseInfo.mobile && (
                  <div>
                    <Label className="text-xs text-slate-600">手机号</Label>
                    <p className="text-slate-800 font-medium">{licenseInfo.mobile}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 使用统计 */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">使用情况</h2>
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-4 space-y-3">
              <div>
                <Label className="text-xs text-slate-600">今日已生成</Label>
                <p className="text-slate-800 font-medium">{getTodayGenerationCount()} 次</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">免费额度</Label>
                <p className="text-slate-800 font-medium">
                  {licenseInfo ? '无限' : `${getTodayGenerationCount()}/5 次`}
                </p>
              </div>
            </div>
          </section>

          {/* 登录按钮 */}
          <div className="pt-4 border-t border-white/40">
            <Button
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-2xl py-3 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              登录账号
            </Button>
            <p className="text-xs text-slate-500 text-center mt-2">
              登录后可保存店铺档案，多设备同步
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="pb-8 space-y-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/60 backdrop-blur-xl border-b border-white/40 p-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          我的
        </h1>
      </header>

      <main className="px-6 space-y-8">
        {/* 会员卡 */}
        <MembershipCard 
          profile={profile} 
          onRedeemSuccess={() => {
            setRefreshKey(prev => prev + 1);
            window.location.reload();
          }}
        />

        {/* 用户信息 */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">账户信息</h2>
          <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-4 space-y-3">
            <div>
              <Label className="text-xs text-slate-600">手机号</Label>
              <p className="text-slate-800 font-medium">{user.phone?.replace(/^\+86/, '') || user.id}</p>
            </div>
            <div>
              <Label className="text-xs text-slate-600">会员等级</Label>
              <p className="text-slate-800 font-medium">
                {profile?.membership_level === 'premium' ? '高级会员' : '普通用户'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-600">每日使用次数</Label>
              <p className="text-slate-800 font-medium">{profile?.daily_usage_count || 0}/{profile?.max_daily_usage || 3}</p>
            </div>
          </div>
        </section>

        {/* 我的档案库 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">我的档案库</h2>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  新建
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl">
                <DialogHeader>
                  <DialogTitle>新建档案</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shop_name">店铺名称</Label>
                    <Input
                      id="shop_name"
                      name="shop_name"
                      value={formData.shop_name}
                      onChange={handleFormChange}
                      placeholder="例如：小王美发店"
                      className="bg-white/80 backdrop-blur-md border-white/40 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">店铺类别</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleFormChange}
                      placeholder="例如：美发、餐饮、服装等"
                      className="bg-white/80 backdrop-blur-md border-white/40 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_audience">目标客户</Label>
                    <Input
                      id="target_audience"
                      name="target_audience"
                      value={formData.target_audience}
                      onChange={handleFormChange}
                      placeholder="例如：25-35岁上班族女性"
                      className="bg-white/80 backdrop-blur-md border-white/40 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unique_selling_point">特色卖点</Label>
                    <Textarea
                      id="unique_selling_point"
                      name="unique_selling_point"
                      value={formData.unique_selling_point}
                      onChange={handleFormChange}
                      placeholder="例如：维生素染发剂、预约制服务、专业理发师"
                      className="bg-white/80 backdrop-blur-md border-white/40 rounded-2xl min-h-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="boss_persona">老板人设</Label>
                    <Textarea
                      id="boss_persona"
                      name="boss_persona"
                      value={formData.boss_persona}
                      onChange={handleFormChange}
                      placeholder="例如：专业严谨、粗禲家帆、热気恥待客人、低调及输、不逑屋折述重侪"
                      className="bg-white/80 backdrop-blur-md border-white/40 rounded-2xl min-h-20"
                    />
                  </div>
                  <Button
                    onClick={handleAddProject}
                    disabled={loading}
                    className="w-full bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-2xl py-3"
                  >
                    {loading ? '创建中...' : '创建档案'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* 档案库列表 */}
          {projects.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>还没有档案，会由为你提供更优秀的AI创作。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => setActiveProject(project)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    activeProject?.id === project.id
                      ? 'bg-blue-600/20 border-blue-400 shadow-md'
                      : 'bg-white/40 border-white/60 hover:bg-white/60'
                  } backdrop-blur-xl`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{project.shop_name}</h3>
                        {activeProject?.id === project.id && (
                          <div className="bg-blue-600 text-white rounded-full p-1">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{project.category} · {project.target_audience}</p>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{project.unique_selling_point}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="ml-2 p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 退出登录 */}
        <div className="pt-4 border-t border-white/40">
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="w-full bg-red-600 hover:bg-red-700 text-white rounded-2xl py-3"
          >
            退出登录
          </Button>
        </div>
      </main>
    </div>
  );
}