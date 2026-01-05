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

const FREE_GENERATION_LIMIT = 5;

export async function POST(request: NextRequest) {
  try {
    const { scriptType, conversionGoal, topic, shopProfile, deviceId } = await request.json();

    // 验证请求参数
    if (!scriptType || !conversionGoal || !topic || !shopProfile) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = await createClient();

    // 获取当前用户（如果已登录）
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 处理认证用户的限额
    if (user) {
      // 获取用户会员信息
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        return new Response(
          JSON.stringify({ error: '获取用户信息失败' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 检查会员是否过期
      const isMember = userProfile?.membership_level === 'premium' || userProfile?.membership_level === 'enterprise';
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
          await supabase
            .from('profiles')
            .update({ daily_usage_count: 1, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        } else if (newUsageCount <= DAILY_LIMIT_FREE) {
          await supabase
            .from('profiles')
            .update({ daily_usage_count: newUsageCount, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      }
    } else if (deviceId) {
      // 处理未认证用户的限额（基于设备 ID）
      const { data: licenses } = await supabase
        .from('license_keys')
        .select('expires_at')
        .eq('device_id', deviceId);

      // 检查是否有有效的许可证
      let hasValidLicense = false;
      if (licenses && licenses.length > 0) {
        for (const license of licenses) {
          if (new Date(license.expires_at) > new Date()) {
            hasValidLicense = true;
            break;
          }
        }
      }

      // 如果没有有效许可证，检查免费限额
      if (!hasValidLicense) {
        // 注意：未认证用户的计数存储在客户端 localStorage 中
        // 我们需要从请求中获取当前计数
        const generationCountHeader = request.headers.get('x-generation-count');
        const currentCount = parseInt(generationCountHeader || '0', 10);

        if (currentCount >= FREE_GENERATION_LIMIT) {
          return new Response(
            JSON.stringify({
              error: '您的免费试用次数已用尽',
              message: `免费试用仅限 ${FREE_GENERATION_LIMIT} 次生成。输入卡密可获得无限生成权限！`,
              shouldShowUpgradeDialog: true,
              limit: FREE_GENERATION_LIMIT,
              used: currentCount,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
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