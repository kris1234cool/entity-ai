'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Video, Download, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface SoraVideoDialogProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'store' | 'product';
}

// 轮询配置
const POLL_INTERVAL = 4000;
const MAX_POLL_ATTEMPTS = 150;

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
    const [duration, setDuration] = useState<10 | 15>(15); // 新增时长状态

    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ossClientRef = useRef<any>(null);
    const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pollCountRef = useRef(0);

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

    // 清理
    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
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

    // 上传图片
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

    // 提交任务
    const handleGenerate = async () => {
        if (!imageUrl) return setError('请先上传参考图片');
        if (!prompt.trim()) return setError('请输入视频描述');

        setGenerating(true);
        setError(null);
        setFinalVideoUrl(null);
        setTaskId(null);
        setStatusText('AI 正在重写脚本并提交任务...');

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
                    duration // 传递时长参数
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // 🎉 任务提交成功,立即给用户反馈
            toast.success('任务已提交,后台开始渲染', {
                description: '预计耗时 2-5 分钟,请勿关闭窗口'
            });

            setTaskId(data.taskId);
            pollCountRef.current = 0;
            setStatusText('AI 正在生成中...');
            pollStatus(data.taskId);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '提交任务失败';
            setError(msg);
            setGenerating(false);
            toast.error('提交失败', { description: msg });
        }
    };

    // 轮询逻辑
    const pollStatus = async (tid: string) => {
        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
            setGenerating(false);
            setError('生成超时，请稍后在历史记录中查看');
            return;
        }

        try {
            const res = await fetch(`/api/sora-generate?taskId=${tid}`);
            const data = await res.json();

            console.log('📊 Frontend Poll Response:', data);

            if (data.error) throw new Error(data.error);

            // APIMart 返回结构: { code: 200, data: { status: "completed", result: { videos: [...] } } }
            const status = data.data?.status || data.status;

            console.log('🔍 Task Status:', status);

            if (status === 'completed') {
                // 视频 URL 在 data.result.videos[0].url[0] 或 data.result.videos[0].url (如果是字符串)
                const videoUrl = data.data?.result?.videos?.[0]?.url?.[0] ||
                    data.data?.result?.videos?.[0]?.url ||
                    data.result?.videos?.[0]?.url?.[0] ||
                    data.result?.videos?.[0]?.url;

                console.log('🎥 Extracted Video URL:', videoUrl);

                if (videoUrl) {
                    setFinalVideoUrl(videoUrl);
                    setGenerating(false);
                    setProgress(100);
                    setStatusText('✅ 生成成功!');
                    toast.success('视频生成完成!', { description: '可以预览和下载了' });
                    return;
                } else {
                    console.error('❌ Status completed but no video URL found:', data);
                    throw new Error('视频生成完成但未找到视频链接');
                }
            } else if (status === 'failed') {
                const errorMsg = data.error || data.message || data.data?.error || '生成失败';
                toast.error('生成失败', { description: errorMsg });
                throw new Error(errorMsg);
            }

            // 继续轮询
            pollCountRef.current++;
            setProgress(Math.min(95, Math.floor((pollCountRef.current / 60) * 100)));
            pollTimerRef.current = setTimeout(() => pollStatus(tid), POLL_INTERVAL);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '查询状态失败';
            console.error('❌ Poll Error:', msg);

            if (pollCountRef.current < 5) {
                pollTimerRef.current = setTimeout(() => pollStatus(tid), POLL_INTERVAL);
            } else {
                setError(msg);
                setGenerating(false);
            }
        }
    };

    // 下载
    const handleDownload = async () => {
        if (!finalVideoUrl) return;

        try {
            toast.loading('正在下载视频...', { id: 'download-video' });

            // 使用 fetch 下载视频
            const response = await fetch(finalVideoUrl);
            const blob = await response.blob();

            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sora-video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();

            // 清理
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('视频下载成功!', { id: 'download-video' });
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('下载失败,请重试', { id: 'download-video' });
            // 降级方案:在新标签页打开
            window.open(finalVideoUrl, '_blank');
        }
    };

    const handleReset = () => {
        setTaskId(null);
        setFinalVideoUrl(null);
        setGenerating(false);
        setError(null);
        setProgress(0);
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
                    {finalVideoUrl ? (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            <div className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-lg">
                                <video src={finalVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                            </div>
                            <div className="flex gap-4">
                                <Button onClick={handleDownload} className="flex-1 bg-green-600 hover:bg-green-700">
                                    <Download className="w-4 h-4 mr-2" /> 下载视频
                                </Button>
                                <Button variant="outline" onClick={handleReset} className="flex-1">
                                    <RefreshCcw className="w-4 h-4 mr-2" /> 再来一个
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
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

                            {/* Settings Area - Vertical Stack Layout */}
                            <div className="flex flex-col gap-5 p-4 bg-slate-50 rounded-xl border border-slate-100">

                                {/* 1. Video Ratio */}
                                <div className="space-y-2">
                                    <Label className="text-slate-600">视频比例</Label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setRatio('16:9')}
                                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${ratio === '16:9' ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'
                                                }`}
                                        >
                                            🖥️ 16:9 (横屏)
                                        </button>
                                        <button
                                            onClick={() => setRatio('9:16')}
                                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${ratio === '9:16' ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'
                                                }`}
                                        >
                                            📱 9:16 (竖屏)
                                        </button>
                                    </div>
                                </div>

                                {/* 2. Duration Selector */}
                                <div className="space-y-2">
                                    <Label className="text-slate-600">视频时长</Label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setDuration(10)}
                                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${duration === 10 ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'
                                                }`}
                                        >
                                            ⏱️ 10 秒
                                        </button>
                                        <button
                                            onClick={() => setDuration(15)}
                                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${duration === 15 ? 'bg-white border-purple-500 text-purple-600 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'
                                                }`}
                                        >
                                            ⏱️ 15 秒
                                        </button>
                                    </div>
                                </div>

                                {/* 3. Model Engine Switch */}
                                <div className="flex items-center justify-between py-1">
                                    <div className="flex flex-col">
                                        <Label className="text-slate-700 font-medium">模型引擎</Label>
                                        <span className="text-xs text-slate-400">升级 Pro 版可获得更佳画质</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-medium ${model === 'sora-2' ? 'text-slate-700' : 'text-slate-400'}`}>
                                            Standard
                                        </span>
                                        <Switch
                                            checked={model === 'sora-2-pro'}
                                            onCheckedChange={(c: boolean) => {
                                                console.log('Toggle Switch:', c);
                                                setModel(c ? 'sora-2-pro' : 'sora-2');
                                            }}
                                        />
                                        <span className={`text-sm font-medium ${model === 'sora-2-pro' ? 'text-purple-600' : 'text-slate-400'}`}>
                                            Pro
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                                    {error}
                                </div>
                            )}

                            {/* Progress Bar - 显示在生成中 */}
                            {generating && (
                                <div className="space-y-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-indigo-700">AI 正在生成中...</span>
                                        <span className="text-indigo-600 font-bold">{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-3" />
                                    <p className="text-xs text-slate-500 text-center">
                                        预计耗时 2-5 分钟,请勿关闭窗口
                                    </p>
                                </div>
                            )}

                            {/* Submit Button - 生成中时隐藏 */}
                            {!generating && (
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!imageUrl}
                                    className="w-full h-12 text-lg font-medium transition-all bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center gap-2">
                                        <Video className="w-5 h-5" />
                                        <span>开始生成视频</span>
                                    </div>
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
