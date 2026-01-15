'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';

interface SoraVideoDialogProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'store' | 'product';
}

export default function SoraVideoDialog({
    isOpen,
    onClose,
    type
}: SoraVideoDialogProps) {
    // Constants
    const STORE_TAGS = ['📷 进店视角', '🔥 锅气十足', '👥 高朋满座', '🗣️ 只有环境音', '🎥 运镜平滑'];
    const PRODUCT_TAGS = ['🔍 细节特写', '💡 高级影棚光', '🔄 360度展示', '✨ 慢动作', '💎 质感无敌'];

    const STORE_PLACEHOLDER = "例如：第一人称走进火锅店，镜头推进。店内热气腾腾，满座的顾客正在聊天，环境嘈杂热闹。老板娘对着镜头说：‘欢迎光临，刚出锅的毛肚！’";
    const PRODUCT_PLACEHOLDER = "例如：一双红色运动鞋的特写，360度缓慢旋转展示。柔和的影棚光打在鞋面上，展示透气网面细节。背景是干净的高级灰。画外音：‘这双鞋，透气性绝了！’";

    // State
    const [prompt, setPrompt] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [model, setModel] = useState<'sora-2' | 'sora-2-pro'>('sora-2');
    const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9');
    const [duration, setDuration] = useState<10 | 15>(15);

    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ossClientRef = useRef<any>(null);

    // 初始化 OSS
    useEffect(() => {
        if (typeof window !== 'undefined' && !ossClientRef.current) {
            const OSS = require('ali-oss');
            ossClientRef.current = new OSS({
                region: process.env.NEXT_PUBLIC_OSS_REGION!,
                accessKeyId: process.env.NEXT_PUBLIC_OSS_ACCESS_KEY_ID!,
                accessKeySecret: process.env.NEXT_PUBLIC_OSS_ACCESS_KEY_SECRET!,
                bucket: process.env.NEXT_PUBLIC_OSS_BUCKET!,
                secure: true,
            });
        }
    }, []);

    // 默认 Prompt
    useEffect(() => {
        if (isOpen && !prompt) {
            if (type === 'store') {
                setPrompt('Camera flies through the store entrance, revealing a busy, well-lit interior with customers browsing...');
            } else {
                setPrompt('Close-up shot of the product on a luxury texture background, studio lighting, 4k detail...');
            }
        }
    }, [isOpen, type, prompt]);

    // Handle Tag Click
    const handleTagClick = (tag: string) => {
        setPrompt(prev => {
            const cleanTag = tag.substring(2).trim(); // Remove emoji
            return prev ? `${prev}，${cleanTag}` : cleanTag;
        });
    };

    // 上传图片 (KEEP EXACTLY AS IS)
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            const filename = `sora_uploads/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const result = await ossClientRef.current.multipartUpload(filename, file);
            const url = `https://${process.env.NEXT_PUBLIC_OSS_BUCKET}.${process.env.NEXT_PUBLIC_OSS_REGION}.aliyuncs.com/${result.name}`;
            setImageUrl(url);
        } catch (err) {
            console.error('Upload failed:', err);
            setError('图片上传失败，请重试');
        } finally {
            setUploading(false);
        }
    };

    // 提交任务 (MODIFIED)
    const handleGenerate = async () => {
        if (!imageUrl) return setError('请先上传参考图片');
        if (!prompt.trim()) return setError('请输入视频描述');

        setGenerating(true);
        setError(null);

        try {
            const res = await fetch('/api/sora-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    prompt,
                    type,
                    ratio,
                    model,
                    duration
                })
            });

            const data = await res.json();

            // Handle Concurrency Limit (429)
            if (res.status === 429) {
                const errorMsg = data.error || '当前队列已满，请稍后再试';
                setError(errorMsg);
                toast.error('请求受限', { description: errorMsg });
                setGenerating(false);
                return;
            }

            if (data.error) throw new Error(data.error);

            // Success: Close immediately and notify
            toast.success('任务已提交', {
                description: '视频将在后台生成，请在历史记录中查看进度'
            });
            onClose();

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '提交任务失败';
            setError(msg);
            setGenerating(false);
            toast.error('提交失败', { description: msg });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        {type === 'store' ? '🏪 实景门店探店视频' : '🛍️ 爆款带货视频'}
                        <span className="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-0.5 rounded-full ml-2">
                            Sora-2
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label>1. 上传参考图片</Label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${imageUrl ? 'border-purple-500 bg-purple-50' : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50'}
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}
                  `}
                        >
                            {imageUrl ? (
                                <div className="relative h-48 w-full">
                                    <img src={imageUrl} alt="Reference" className="h-full w-full object-contain rounded-lg" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                        <span className="text-white font-medium">点击更换</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-slate-500">
                                    {uploading ? (
                                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                    ) : (
                                        <Upload className="w-8 h-8" />
                                    )}
                                    <p className="text-sm">
                                        {uploading ? '上传中...' : '点击上传图片，支持 JPG/PNG'}
                                    </p>
                                </div>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>

                    {/* Prompt Input */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>2. 视频描述 (AI 会自动优化)</Label>
                            <span className="text-xs text-slate-400">💡 提示：描述越具体，效果越好</span>
                        </div>

                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={type === 'store' ? STORE_PLACEHOLDER : PRODUCT_PLACEHOLDER}
                            className="min-h-[120px] text-base"
                            style={{ fontSize: '16px' }}
                        />

                        {/* Magic Tags */}
                        <div className="flex flex-wrap gap-2">
                            {(type === 'store' ? STORE_TAGS : PRODUCT_TAGS).map((tag) => (
                                <button
                                    key={tag}
                                    onClick={() => handleTagClick(tag)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 text-xs rounded-full transition-colors border border-slate-200"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Settings Area */}
                    <div className="flex flex-col gap-5 p-4 bg-slate-50 rounded-xl border border-slate-100">

                        {/* Ratio */}
                        <div className="space-y-2">
                            <Label className="text-slate-600">视频比例</Label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRatio('16:9')}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${ratio === '16:9' ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'}`}
                                >
                                    🖥️ 16:9 (横屏)
                                </button>
                                <button
                                    onClick={() => setRatio('9:16')}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${ratio === '9:16' ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'}`}
                                >
                                    📱 9:16 (竖屏)
                                </button>
                            </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-2">
                            <Label className="text-slate-600">视频时长</Label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDuration(10)}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${duration === 10 ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'}`}
                                >
                                    ⏱️ 10 秒
                                </button>
                                <button
                                    onClick={() => setDuration(15)}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${duration === 15 ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'}`}
                                >
                                    ⏱️ 15 秒
                                </button>
                            </div>
                        </div>

                        {/* Model Engine */}
                        <div className="flex items-center justify-between py-1">
                            <div className="flex flex-col">
                                <Label className="text-slate-700 font-medium">模型引擎</Label>
                                <span className="text-xs text-slate-400">升级 Pro 版可获得更佳画质</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-medium ${model === 'sora-2' ? 'text-slate-700' : 'text-slate-400'}`}>Standard</span>
                                <Switch
                                    checked={model === 'sora-2-pro'}
                                    onCheckedChange={(c: boolean) => setModel(c ? 'sora-2-pro' : 'sora-2')}
                                />
                                <span className={`text-sm font-medium ${model === 'sora-2-pro' ? 'text-purple-600' : 'text-slate-400'}`}>Pro</span>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={generating || !imageUrl}
                        className="w-full h-12 text-lg font-medium transition-all bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>提交中...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Video className="w-5 h-5" />
                                <span>开始生成视频</span>
                            </div>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
