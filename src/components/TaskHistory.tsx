'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Play, Download, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface VideoTask {
    id: string;
    task_id: string;
    created_at: string;
    status: 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    image_url: string;
    video_url: string | null;
    prompt: string;
}

export default function TaskHistory() {
    const [tasks, setTasks] = useState<VideoTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [progressMap, setProgressMap] = useState<Record<string, number>>({});

    // Safety ref to prevent state updates on unmounted component
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Simulated Progress logic for active tasks
    useEffect(() => {
        const interval = setInterval(() => {
            setProgressMap(prev => {
                const newMap = { ...prev };
                let changed = false;
                tasks.forEach(task => {
                    if (task.status === 'SUBMITTED' || task.status === 'PROCESSING') {
                        const current = newMap[task.task_id] || (task.status === 'SUBMITTED' ? 10 : 30);
                        if (current < 90) {
                            // Random increment between 0.5% and 2%
                            newMap[task.task_id] = current + Math.random() * 1.5 + 0.5;
                            changed = true;
                        }
                    } else {
                        // Cleanup completed/failed tasks
                        if (newMap[task.task_id]) {
                            delete newMap[task.task_id];
                            changed = true;
                        }
                    }
                });
                return changed ? newMap : prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [tasks]);

    // Core Fetch Logic
    const fetchTasks = useCallback(async (isAutoPoll = false) => {
        if (!isAutoPoll) setRefreshing(true);

        try {
            // 1. Get latest list from API (This handles the dev user backdoor correctly)
            const res = await fetch('/api/sora-generate');
            if (!res.ok) throw new Error('Failed to fetch tasks');

            const data = await res.json();
            const currentTasks = (data.tasks as VideoTask[]) || [];

            if (mountedRef.current) {
                setTasks(currentTasks);
                setLoading(false);
            }

            // 2. Identify active tasks that need syncing
            const activeTasks = currentTasks.filter(t =>
                t.status === 'SUBMITTED' || t.status === 'PROCESSING'
            );

            // 3. Sync each active task
            if (activeTasks.length > 0) {
                console.log(`🔄 Syncing ${activeTasks.length} active tasks...`);
                await Promise.all(activeTasks.map(async (task) => {
                    try {
                        const res = await fetch(`/api/sora-generate?taskId=${task.task_id}`);
                        const result = await res.json();
                        console.log(`Start Sync Task ${task.task_id}:`, result);
                    } catch (e) {
                        console.error(`Failed to sync task ${task.task_id}`, e);
                    }
                }));

                // 4. Re-fetch after sync to get updated state
                const resAfter = await fetch('/api/sora-generate');
                const dataAfter = await resAfter.json();

                if (mountedRef.current && dataAfter.tasks) {
                    setTasks(dataAfter.tasks as VideoTask[]);
                }
            }

        } catch (err) {
            console.error('Fetch tasks error:', err);
            if (!isAutoPoll) toast.error('刷新失败');
            if (mountedRef.current) setLoading(false);
        } finally {
            if (mountedRef.current) setRefreshing(false);
        }
    }, []);

    // Initial Load & Polling
    useEffect(() => {
        fetchTasks(); // Initial fetch

        const intervalId = setInterval(() => {
            fetchTasks(true); // Auto poll
        }, 5000);

        return () => clearInterval(intervalId);
    }, [fetchTasks]);

    // Robust Download Handler
    const handleDownload = async (url: string | null, taskId: string) => {
        if (!url) return;
        setDownloading(taskId);

        try {
            // Fetch blob to force download
            const response = await fetch(url);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `sora-video-${taskId.slice(0, 8)}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(blobUrl);
            toast.success('下载任务已开始');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('下载出错，尝试打开新窗口');
            window.open(url, '_blank');
        } finally {
            setDownloading(null);
        }
    };

    if (loading) {
        return <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>;
    }

    if (tasks.length === 0) {
        return <div className="text-center py-10 text-slate-400">暂无生成记录</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchTasks(false)}
                    disabled={refreshing}
                    className="text-slate-500 hover:text-indigo-600"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    刷新状态
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => {
                    const isProcessing = task.status === 'SUBMITTED' || task.status === 'PROCESSING';
                    // Calculated progress or default start
                    const progress = progressMap[task.task_id] || (task.status === 'SUBMITTED' ? 10 : 30);

                    return (
                        <Card key={task.id} className="overflow-hidden border-slate-200">
                            <CardContent className="p-0 relative group">
                                {/* Status Overlay */}
                                <div className="aspect-video bg-slate-100 relative">
                                    {task.status === 'COMPLETED' && task.video_url ? (
                                        <video
                                            src={task.video_url}
                                            controls
                                            className="w-full h-full object-cover"
                                            poster={task.image_url}
                                        />
                                    ) : (
                                        <img
                                            src={task.image_url}
                                            alt="Reference"
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                    )}

                                    {/* Processing Overlay with Progress */}
                                    {isProcessing && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm px-8">
                                            <div className="w-full max-w-[200px] flex flex-col items-center gap-3">
                                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                                <div className="w-full space-y-1.5">
                                                    <div className="flex justify-between text-xs text-indigo-100 font-medium">
                                                        <span>{task.status === 'SUBMITTED' ? '提交任务中...' : 'Sora 正在生成...'}</span>
                                                        <span>{Math.round(progress)}%</span>
                                                    </div>
                                                    <Progress value={progress} className="h-1.5 bg-white/20" />
                                                </div>
                                                <p className="text-[10px] text-center text-slate-300">
                                                    预计耗时 1-3 分钟<br />您可以离开页面，稍后回来查看
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {task.status === 'FAILED' && (
                                        <div className="absolute inset-0 bg-red-900/40 flex flex-col items-center justify-center text-white">
                                            <AlertTriangle className="w-8 h-8 mb-2 text-red-400" />
                                            <span className="font-medium text-sm">生成失败</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info Area */}
                                <div className="p-3 space-y-2">
                                    <p className="text-xs text-slate-500 line-clamp-2" title={task.prompt}>
                                        {task.prompt}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(task.created_at).toLocaleString()}
                                        </span>

                                        {task.status === 'COMPLETED' && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDownload(task.video_url, task.task_id)}
                                                disabled={downloading === task.task_id}
                                                className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                            >
                                                {downloading === task.task_id ? (
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                ) : (
                                                    <Download className="w-3 h-3 mr-1" />
                                                )}
                                                下载
                                            </Button>
                                        )}
                                    </div>

                                    {task.status === 'COMPLETED' && (
                                        <div className="text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded flex items-center gap-1 mt-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            ⚠️ 链接24小时后失效，请立即下载！
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
