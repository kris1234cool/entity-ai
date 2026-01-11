import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, getConversionGoalInstruction, getScriptTypePrompt, getXueHuiIdeasPrompt, getXueHuiScriptPrompt } from '@/lib/prompts';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

// 配置 OpenAI 客户端，兼容 DeepSeek
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // 使用 DeepSeek API 端点
});

export async function POST(request: NextRequest) {
  try {
    const { scriptType, conversionGoal, topic, shopProfile, step, industry, location, selected_hook } = await request.json();

    // 验证请求参数
    if (step === 'ideas') {
      if (!industry || !location) {
        return new Response(
          JSON.stringify({ error: '缺少必要参数: industry, location' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (step === 'script') {
      if (!selected_hook || !industry || !location) {
        return new Response(
          JSON.stringify({ error: '缺少必要参数: selected_hook, industry, location' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (!scriptType || !conversionGoal || !topic || !shopProfile) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户信息和检查权限
    const supabase = await createClient();
    let userId: string | null = null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (user && !authError) {
      userId = user.id;
    } else if (request.headers.get('x-user-phone')) {
      const phone = request.headers.get('x-user-phone');
      userId = `lead_${phone}`;
    } else {
      return new Response(
        JSON.stringify({ error: '请先登录' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: '获取用户信息失败' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isMember = userProfile?.membership_level === 'premium' || userProfile?.membership_level === 'enterprise';
    const membershipExpiry = userProfile?.membership_expire_at
      ? new Date(userProfile.membership_expire_at)
      : new Date();
    const isMembershipValid = isMember && membershipExpiry > new Date();

    const DAILY_LIMIT_FREE = 3;
    const currentUsage = userProfile?.daily_usage_count || 0;

    // 检查限制 (仅在 Ideas 或原有的脚本生成模式下计数)
    const isNewGeneration = step === 'ideas' || (!step && !selected_hook);
    if (isNewGeneration && !isMembershipValid && currentUsage >= DAILY_LIMIT_FREE) {
      return new Response(
        JSON.stringify({
          error: '今日生成次数已达上限',
          message: '您的免费额度已用尽，请升级为 VIP 会员获得无限生成权限',
          shouldShowUpgradeDialog: true,
          limit: DAILY_LIMIT_FREE,
          used: currentUsage,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 更新计数
    if (isNewGeneration && !isMembershipValid) {
      const newUsageCount = currentUsage + 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastUpdateDate = userProfile?.updated_at
        ? new Date(userProfile.updated_at)
        : new Date(0);
      lastUpdateDate.setHours(0, 0, 0, 0);
      
      if (lastUpdateDate.getTime() < today.getTime()) {
        await supabase
          .from('profiles')
          .update({ daily_usage_count: 1, updated_at: new Date().toISOString() })
          .eq('id', userId);
      } else {
        await supabase
          .from('profiles')
          .update({ daily_usage_count: newUsageCount, updated_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }

    // 准备 LLM 请求
    let systemPrompt = '';
    let userPrompt = '';
    let responseFormat: any = undefined;

    if (step === 'ideas') {
      systemPrompt = getXueHuiIdeasPrompt();
      userPrompt = `业务领域: ${industry}\n地理位置: ${location}`;
      responseFormat = { type: 'json_object' };
    } else if (step === 'script') {
      systemPrompt = getXueHuiScriptPrompt();
      userPrompt = `业务领域: ${industry}\n地理位置: ${location}\n选中的最帕: ${selected_hook}`;
    } else {
      // 原有的脚本生成模式
      const conversionGoalInstruction = getConversionGoalInstruction(conversionGoal);
      const scriptTypeInstruction = getScriptTypePrompt(scriptType);
      systemPrompt = SYSTEM_PROMPT;
      userPrompt = `
店铺档案:
- 店铺名称: ${shopProfile.shop_name}
- 店铺类别: ${shopProfile.category}
- 目标客户: ${shopProfile.target_audience}
- 独特卖点: ${shopProfile.unique_selling_point}
- 老板人设: ${shopProfile.boss_persona}

创作要求:
- 脚本类型: ${scriptType}
- 转化目标: ${conversionGoal}
- 主题关键词: ${topic}

具体指令:
${scriptTypeInstruction}
${conversionGoalInstruction}

请严格按照以下 JSON 格式返回结果，不要添加任何其他内容：
{
  "title": "脚本标题",
  "cover_text": "封面文案",
  "script_list": [
    {
      "visual": "画面描述",
      "audio": "台词内容", 
      "emotion": "情绪表达"
    }
  ]
}
      `;
      responseFormat = { type: 'json_object' };
    }

    // 调用 AI 模型 (启用流式)
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      stream: true,
      response_format: responseFormat,
    });

    // 使用原生 ReadableStream 处理流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API 错误:', error);
    const errorMessage = error.message || '处理请求时出现错误';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}