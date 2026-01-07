import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, getConversionGoalInstruction, getScriptTypePrompt } from '@/lib/prompts';
import { ScriptResult } from '@/types';
import { createClient } from '@/utils/supabase/server';

// 配置 OpenAI 客户端，兼容 DeepSeek
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // 使用 DeepSeek API 端点
});

export async function POST(request: NextRequest) {
  try {
    const { scriptType, conversionGoal, topic, shopProfile } = await request.json();

    // 验证请求参数
    if (!scriptType || !conversionGoal || !topic || !shopProfile) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查用户会员状态和日限制
    const supabase = await createClient();
    
    // 尝试从 Supabase 认证获取用户
    let userId: string | null = null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (user && !authError) {
      // 传统 Supabase 认证用户
      userId = user.id;
    } else if (request.headers.get('x-user-phone')) {
      // 线索收集模式：从请求头获取手机号
      const phone = request.headers.get('x-user-phone');
      userId = `lead_${phone}`;
    } else {
      return new Response(
        JSON.stringify({ error: '请先登录' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户会员信息
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

    // 检查会员是否过期
    const isMember = userProfile?.membership_level === 'premium';
    const membershipExpiry = userProfile?.membership_expire_at
      ? new Date(userProfile.membership_expire_at)
      : new Date();
    const isMembershipValid = isMember && membershipExpiry > new Date();

    // 自由用户限制为 3 次/天，会员无限制
    const DAILY_LIMIT_FREE = 3;
    const currentUsage = userProfile?.daily_usage_count || 0;

    if (!isMembershipValid && currentUsage >= DAILY_LIMIT_FREE) {
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

    // 更新用户的日使用次数
    if (!isMembershipValid) {
      const newUsageCount = currentUsage + 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastUpdateDate = userProfile?.updated_at
        ? new Date(userProfile.updated_at)
        : new Date(0);
      lastUpdateDate.setHours(0, 0, 0, 0);
      
      // 如果是新的一天，重置计数为 1
      if (lastUpdateDate.getTime() < today.getTime()) {
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
            
        // 如果是新用户，重置计数
        if (profileError) {
          await supabase
            .from('profiles')
            .insert([{
              id: userId,
              phone: request.headers.get('x-user-phone') || '',
              membership_level: 'free',
              max_daily_usage: 3,
              daily_usage_count: 1
            }]);
        } else {
          await supabase
            .from('profiles')
            .update({ daily_usage_count: 1, updated_at: new Date().toISOString() })
            .eq('id', userId);
        }
      } else if (newUsageCount <= DAILY_LIMIT_FREE) {
        await supabase
          .from('profiles')
          .update({ daily_usage_count: newUsageCount, updated_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }
    const conversionGoalInstruction = getConversionGoalInstruction(conversionGoal);
    const scriptTypeInstruction = getScriptTypePrompt(scriptType);
    
    const userPrompt = `
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

    // 调用 AI 模型
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat', // 使用 DeepSeek 模型
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }, // 要求返回 JSON 格式
    });

    const aiResponse = response.choices[0].message?.content;

    if (!aiResponse) {
      return new Response(
        JSON.stringify({ error: 'AI 未返回有效内容' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 解析 AI 返回的 JSON
    let scriptResult: ScriptResult;
    try {
      // 尝试解析 AI 返回的内容，可能包含 Markdown 代码块
      const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```|```([\s\S]*?)```|({[\s\S]*})/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[2] || jsonMatch[3]) : aiResponse;
      
      if (!jsonString) {
        throw new Error('无法从 AI 响应中提取 JSON 内容');
      }
      
      scriptResult = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error('JSON 解析错误:', parseError);
      console.error('AI 响应内容:', aiResponse);
      return new Response(
        JSON.stringify({ 
          error: 'AI 返回格式错误',
          details: '无法解析 AI 返回的 JSON 格式'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证返回的 JSON 结构
    if (!scriptResult.title || !scriptResult.cover_text || !Array.isArray(scriptResult.script_list)) {
      return new Response(
        JSON.stringify({ 
          error: 'AI 返回格式不符合要求',
          details: '缺少必要的字段: title, cover_text, script_list'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 返回生成的脚本
    return new Response(JSON.stringify(scriptResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API 错误:', error);
    
    let errorMessage = '生成脚本时出现错误';
    if (error.response) {
      errorMessage = `API 错误: ${error.response.status} - ${error.response.statusText}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}