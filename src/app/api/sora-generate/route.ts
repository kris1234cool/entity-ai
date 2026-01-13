import { NextResponse } from 'next/server';
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
        const body = await req.json();
        const { model, duration, imageUrl, prompt, type, ratio } = body;

        // 验证必要参数
        if (!imageUrl || !prompt || !type || !ratio) {
            return NextResponse.json(
                { error: 'Missing required parameters: imageUrl, prompt, type, ratio' },
                { status: 400 }
            );
        }

        // 🔒 模型选择逻辑（使用通用 Key）
        const targetModel = model === 'sora-2-pro' ? 'sora-2-pro' : 'sora-2';

        // Debug Log
        console.log("Using Model: " + targetModel);
        console.log(`🔑 Using Universal Key: ${APIMART_KEY.substring(0, 10)}...`);

        // 3. Prompt Engineering (DeepSeek "Director Mode")
        let rewrittenPrompt = prompt;

        // Define System Prompts
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
            console.log("🔴 [DeepSeek Input]:", prompt);

            if (!DEEPSEEK_KEY) {
                console.warn("⚠️ DEEPSEEK_API_KEY is missing! Using raw prompt. Please set it in .env.local");
            } else {
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
                console.log("🟢 [DeepSeek Output]:", rewrittenPrompt);
            }
        } catch (deepseekError) {
            console.error('❌ DeepSeek Optimization Failed:', deepseekError);
            // Fallback to original prompt is automatic since rewrittenPrompt initialized to prompt
        }

        // 发送请求给 APIMart
        console.log('🎬 Calling APIMart Sora-2 API...');
        console.log('📦 Request Body:', JSON.stringify({
            model: targetModel,
            prompt: rewrittenPrompt.substring(0, 100) + '...',
            image_urls: [imageUrl],
            duration: duration || 15,
            aspect_ratio: ratio,
        }));

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
            console.error('🚨 Network Error:', fetchError);
            const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown network error';
            return NextResponse.json({
                error: `网络请求失败: ${errorMsg}。可能原因：1) 网络代理配置问题 2) DNS解析失败 3) 防火墙阻止。请检查网络设置或尝试关闭VPN/代理。`
            }, { status: 500 });
        }

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('❌ APIMart API Error:', errorText);
            return NextResponse.json(
                { error: `APIMart API Error: ${errorText}` },
                { status: apiResponse.status }
            );
        }

        const apiData = await apiResponse.json();
        console.log('✅ APIMart Response (Full):', JSON.stringify(apiData, null, 2));

        // APIMart 返回结构: { data: [{ task_id: "xxx" }] }
        const taskId = apiData.data?.[0]?.task_id ||
            apiData.data?.task_id ||
            apiData.task_id ||
            apiData.data?.[0]?.id ||
            apiData.id;

        console.log('📌 Extracted Task ID:', taskId);

        if (!taskId) {
            console.error('❌ Failed to extract task_id from response:', apiData);
            return NextResponse.json({
                error: 'API 返回数据中未找到 task_id，请检查 APIMart API 文档'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            taskId: taskId,
            rewrittenPrompt,
            originalPrompt: prompt,
        });
    } catch (error: unknown) {
        console.error('Generate Sora Video Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `服务器错误: ${message}` }, { status: 500 });
    }
}

/**
 * GET: 查询任务状态
 * Query: ?taskId=xxx
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json({ error: 'Missing taskId parameter' }, { status: 400 });
        }

        // 使用通用 Key 查询任务状态
        const response = await fetch(`https://api.apimart.ai/v1/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${APIMART_KEY}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ APIMart Query Error:', errorText);
            return NextResponse.json(
                { error: `Query Error: ${errorText}` },
                { status: response.status }
            );
        }
        const data = await response.json();
        console.log('📊 Task Query Response:', JSON.stringify(data, null, 2));
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('Query Task Status Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
