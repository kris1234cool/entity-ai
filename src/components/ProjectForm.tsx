'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface ProjectFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
}

export default function ProjectForm({ onSubmit, initialData }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    shop_name: initialData?.shop_name || '',
    category: initialData?.category || '',
    target_audience: initialData?.target_audience || '',
    unique_selling_point: initialData?.unique_selling_point || '',
    boss_persona: initialData?.boss_persona || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="w-full bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl shadow-lg">
      <CardHeader className="bg-white/40 backdrop-blur-md border-b border-white/40">
        <CardTitle className="text-xl font-semibold text-slate-800">店铺档案</CardTitle>
        <CardDescription className="text-slate-600">
          请填写您的店铺信息，这将帮助 AI 生成更精准的文案
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="shop_name" className="text-slate-700 font-medium">店铺名称</Label>
            <Input
              id="shop_name"
              name="shop_name"
              value={formData.shop_name}
              onChange={handleChange}
              placeholder="例如：小王美发店"
              className="bg-white/80 backdrop-blur-md border-white/40 text-slate-800 placeholder:text-slate-400 rounded-2xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-slate-700 font-medium">店铺类别</Label>
            <Input
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="例如：美发、餐饮、服装、教育等"
              className="bg-white/80 backdrop-blur-md border-white/40 text-slate-800 placeholder:text-slate-400 rounded-2xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_audience" className="text-slate-700 font-medium">目标客户</Label>
            <Input
              id="target_audience"
              name="target_audience"
              value={formData.target_audience}
              onChange={handleChange}
              placeholder="例如：25-35岁上班族女性"
              className="bg-white/80 backdrop-blur-md border-white/40 text-slate-800 placeholder:text-slate-400 rounded-2xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unique_selling_point" className="text-slate-700 font-medium">独特卖点</Label>
            <Textarea
              id="unique_selling_point"
              name="unique_selling_point"
              value={formData.unique_selling_point}
              onChange={handleChange}
              placeholder="例如：使用纯天然染发剂，10年经验师傅，预约制一对一服务"
              className="bg-white/80 backdrop-blur-md border-white/40 text-slate-800 placeholder:text-slate-400 min-h-[100px] rounded-2xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="boss_persona" className="text-slate-700 font-medium">老板人设</Label>
            <Textarea
              id="boss_persona"
              name="boss_persona"
              value={formData.boss_persona}
              onChange={handleChange}
              placeholder="例如：从业10年经验，对品质要求极高，亲和力强，注重客户体验"
              className="bg-white/80 backdrop-blur-md border-white/40 text-slate-800 placeholder:text-slate-400 min-h-[100px] rounded-2xl"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-6 text-base shadow-lg rounded-full"
          >
            保存档案并开始创作
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}