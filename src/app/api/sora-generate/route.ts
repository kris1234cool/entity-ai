import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import OpenAI from 'openai';

export const runtime = 'nodejs';

// ⚠️ 使用通用测试 Key（支持所有模型）
const APIMART_KEY = 'sk-JswMPW0XusW02MZhb6M9EW3aGGqV4K8MDeIxfCwxEuf961cQ';

// DeepSeek 配置
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

/**
 * POST: 生成 Sora-2 视频
 * Body: { imageUrl, prompt, type, ratio, model, duration }
 */
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Auth Check (Smart Backdoor for Dev)
        let userId = user?.id;
        if (!userId && process.env.NODE_ENV === 'development') {
            userId = 'dev_test_user_001';
            console.warn("⚠️ Using Dev User ID");
        }
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { model, duration, imageUrl, prompt, type, ratio } = body;

        // 验证必要参数
        if (!imageUrl || !prompt || !type || !ratio) {
            return NextResponse.json(
                { error: 'Missing required parameters: imageUrl, prompt, type, ratio' },
                { status: 400 }
            );
        }

        // 2. Concurrency Check (The "One at a Time" Rule)
        // ⚠️ Use Admin Client to bypass RLS for the dev user
        const adminSupabase = createAdminClient();

        const { count } = await adminSupabase
            .from('video_generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('status', ['SUBMITTED', 'PROCESSING']);

        if (count && count > 0) {
            return NextResponse.json({ error: '通道拥挤：当前已有视频正在生成，请先等待完成后再试。' }, { status: 429 });
        }

        // 🔒 模型选择逻辑
        const targetModel = model === 'sora-2-pro' ? 'sora-2-pro' : 'sora-2';

        // 3. Prompt Engineering (DeepSeek "Director Mode")
        let rewrittenPrompt = prompt;
        const SYSTEM_PROMPT_STORE = `You are a viral TikTok videographer using Sora-2.
Convert the user's raw description into a professional video prompt.
Structure:
(Visual Description): [First-person view entering the shop, smooth gimbal movement, 4k detail]
(Atmosphere): [Bustling with customers, steam rising, warm lighting, lively ambient noise]
(Action): [Specific interactions if mentioned]
OUTPUT: A single paragraph of English prompt optimized for Sora.`;

        const SYSTEM_PROMPT_PRODUCT = `You are a high-end commercial director using Sora-2.
Convert the user's raw description into a luxury product advertisement prompt.
Structure:
(Visual Description): [Macro close-up, sharp focus on texture, clean luxury background]
(Lighting): [Professional studio softbox lighting, dynamic reflections]
(Movement): [Slow-motion 360-degree orbit or elegant panning]
OUTPUT: A single paragraph of English prompt optimized for Sora.`;

        try {
            if (DEEPSEEK_KEY) {
                const deepseek = new OpenAI({
                    apiKey: DEEPSEEK_KEY,
                    baseURL: 'https://api.deepseek.com',
                });
                const systemContent = type === 'product' ? SYSTEM_PROMPT_PRODUCT : SYSTEM_PROMPT_STORE;
                const completion = await deepseek.chat.completions.create({
                    messages: [
                        { role: "system", content: systemContent },
                        { role: "user", content: `User Input: ${prompt}` }
                    ],
                    model: "deepseek-chat",
                    temperature: 0.7,
                });
                rewrittenPrompt = completion.choices[0]?.message?.content || prompt;
            }
        } catch (deepseekError) {
            console.error('❌ DeepSeek Optimization Failed:', deepseekError);
        }

        // 4. APIMart Logic
        let apiResponse;
        try {
            apiResponse = await fetch('https://api.apimart.ai/v1/videos/generations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${APIMART_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: targetModel,
                    prompt: rewrittenPrompt,
                    image_urls: [imageUrl],
                    duration: duration || 15,
                    aspect_ratio: ratio,
                }),
            });
        } catch (fetchError: unknown) {
            const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown network error';
            return NextResponse.json({ error: `网络请求失败: ${errorMsg}` }, { status: 500 });
        }

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return NextResponse.json({ error: `APIMart API Error: ${errorText}` }, { status: apiResponse.status });
        }

        const apiData = await apiResponse.json();
        const taskId = apiData.data?.[0]?.task_id || apiData.data?.task_id || apiData.task_id || apiData.data?.[0]?.id || apiData.id;

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID not found in response' }, { status: 500 });
        }

        // 5. DB Persistence (Insert Task)
        const { error: dbError } = await adminSupabase.from('video_generations').insert({
            user_id: userId,
            task_id: taskId,
            type: type,
            status: 'SUBMITTED',
            prompt: prompt, // Save original prompt
            image_url: imageUrl,
            duration: duration || 15,
        });

        if (dbError) {
            console.error('DB Insert Error:', dbError);
        }

        return NextResponse.json({ success: true, taskId });

    } catch (error: any) {
        console.error('Generate Sora Video Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET: 查询任务状态 (Check APIMart & Update DB)
 * Query: ?taskId=xxx
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const taskId = searchParams.get('taskId');
        const isList = searchParams.get('list');

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Auth Check (Same Backdoor as POST)
        let userId = user?.id;
        if (!userId && process.env.NODE_ENV === 'development') {
            userId = 'dev_test_user_001';
        }
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // A. List Mode: Fetch all tasks for user
        if (!taskId) {
            // ⚠️ Use Admin Client for list to ensure we can see dev user tasks
            const adminSupabase = createAdminClient();
            const { data, error } = await adminSupabase
                .from('video_generations')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ tasks: data });
        }

        // B. Single Task Sync Mode

        // 1. Fetch from APIMart
        const response = await fetch(`https://api.apimart.ai/v1/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${APIMART_KEY}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: `Query Error: ${errorText}` }, { status: response.status });
        }

        const data = await response.json();

        // Extract status and result
        const status = data.data?.status || data.status;
        const result = data.data?.result || data.result;

        console.log(`🔍 [Sync Task ${taskId}] Status: ${status}`);
        console.log(`🔍 [Sync Task ${taskId}] Result:`, JSON.stringify(result));

        const videoUrl = result?.videos?.[0]?.url?.[0] || result?.videos?.[0]?.url || null;

        // 2. Update DB if status changed or completed
        let dbStatus = 'PROCESSING';
        if (status === 'completed') dbStatus = 'COMPLETED';
        if (status === 'failed' || status === 'failure') dbStatus = 'FAILED';

        const updatePayload: any = { status: dbStatus };
        if (videoUrl) updatePayload.video_url = videoUrl;

        const adminSupabase = createAdminClient();
        await adminSupabase
            .from('video_generations')
            .update(updatePayload)
            .eq('task_id', taskId);

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('Query Task Status Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
