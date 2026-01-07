import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, getConversionGoalInstruction, getScriptTypePrompt, getXueHuiIdeasPrompt, getXueHuiScriptPrompt } from '@/lib/prompts';
import { ScriptResult, IdeasResult } from '@/types';
import { createClient } from '@/utils/supabase/server';

// 配置 OpenAI 客户端，兼容 DeepSeek
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // 使用 DeepSeek API 端点
});

export async function POST(request: NextRequest) {
  try {
    const { scriptType, conversionGoal, topic, shopProfile, step, industry, location, selected_hook } = await request.json();

    // 验证请求参数
    // ‘流沒一闪争能模式有不同的参数需求
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

    // 灵感一闪特殊模式处理
    if (step === 'ideas' || step === 'script') {
      // 灵感一闪模式：Ideas 和 Script 步骤都计数为生成次数
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

      const isMember = userProfile?.membership_level === 'premium';
      const membershipExpiry = userProfile?.membership_expire_at
        ? new Date(userProfile.membership_expire_at)
        : new Date();
      const isMembershipValid = isMember && membershipExpiry > new Date();

      const DAILY_LIMIT_FREE = 3;
      const currentUsage = userProfile?.daily_usage_count || 0;

      // 仅在 ideas 步骤时检查和计数限制
      if (step === 'ideas' && !isMembershipValid && currentUsage >= DAILY_LIMIT_FREE) {
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

      // 仅在 ideas 步骤时更新计数
      if (step === 'ideas' && !isMembershipValid) {
        const newUsageCount = currentUsage + 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const lastUpdateDate = userProfile?.updated_at
          ? new Date(userProfile.updated_at)
          : new Date(0);
        lastUpdateDate.setHours(0, 0, 0, 0);
        
        if (lastUpdateDate.getTime() < today.getTime()) {
          const { data: existingProfile, error: checkError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
            
          if (checkError) {
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

      // 处理 ideas 步骤
      if (step === 'ideas') {
        const ideasSystemPrompt = getXueHuiIdeasPrompt();
        const ideasUserPrompt = `业务领域: ${industry}\n地理位置: ${location}`;

        const response = await openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: ideasSystemPrompt },
            { role: 'user', content: ideasUserPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        });

        const aiResponse = response.choices[0].message?.content;

        if (!aiResponse) {
          return new Response(
            JSON.stringify({ error: 'AI 未返回有效内容' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        let ideasResult: IdeasResult;
        try {
          const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```|```([\s\S]*)```|({[\s\S]*})/);
          const jsonString = (jsonMatch ? (jsonMatch[1] || jsonMatch[2] || jsonMatch[3]) : aiResponse) || '';
          ideasResult = JSON.parse(jsonString.trim());
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

        if (!ideasResult.reply || !Array.isArray(ideasResult.ammo_boxes)) {
          return new Response(
            JSON.stringify({ 
              error: 'AI 返回格式不符合要求',
              details: '缺少必要的字段: reply, ammo_boxes'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify(ideasResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // 处理 script 步骤
      else if (step === 'script') {
        const scriptSystemPrompt = getXueHuiScriptPrompt();
        const scriptUserPrompt = `业务领域: ${industry}\n地理位置: ${location}\n选中的最帕: ${selected_hook}`;

        const response = await openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: scriptSystemPrompt },
            { role: 'user', content: scriptUserPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2500,
        });

        const aiResponse = response.choices[0].message?.content;

        if (!aiResponse) {
          return new Response(
            JSON.stringify({ error: 'AI 未返回有效内容' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ content: aiResponse }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 原有的脚本生成模式
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

    const isMember = userProfile?.membership_level === 'premium';
    const membershipExpiry = userProfile?.membership_expire_at
      ? new Date(userProfile.membership_expire_at)
      : new Date();
    const isMembershipValid = isMember && membershipExpiry > new Date();

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

    if (!isMembershipValid) {
      const newUsageCount = currentUsage + 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastUpdateDate = userProfile?.updated_at
        ? new Date(userProfile.updated_at)
        : new Date(0);
      lastUpdateDate.setHours(0, 0, 0, 0);
      
      if (lastUpdateDate.getTime() < today.getTime()) {
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
            
        if (checkError) {
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
    });// ‘流沒一闪争能 - Ideas 步骤处理
    if (step === 'ideas') {
      const ideasSystemPrompt = getXueHuiIdeasPrompt();
      const ideasUserPrompt = `业务领域: ${industry}\n地理位置: ${location}`;

      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: ideasSystemPrompt },
          { role: 'user', content: ideasUserPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const aiResponse = response.choices[0].message?.content;

      if (!aiResponse) {
        return new Response(
          JSON.stringify({ error: 'AI 未返回有效内容' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let ideasResult: IdeasResult;
      try {
        const jsonMatch = aiResponse!.match(/```json\n?([\s\S]*?)\n?```|```([\s\S]*)```|({[\s\S]*})/);
        const jsonString = (jsonMatch?.[1] || jsonMatch?.[2] || jsonMatch?.[3] || aiResponse) || '';
        ideasResult = JSON.parse(jsonString.trim());
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

      // 验证 Ideas 结构
      if (!ideasResult.reply || !Array.isArray(ideasResult.ammo_boxes)) {
        return new Response(
          JSON.stringify({ 
            error: 'AI 返回格式不符合要求',
            details: '缺少必要的字段: reply, ammo_boxes'
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify(ideasResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // ‘流沒一闪争能 - Script 步骤处理
    else if (step === 'script') {
      const scriptSystemPrompt = getXueHuiScriptPrompt();
      const scriptUserPrompt = `业务领域: ${industry}\n地理位置: ${location}\n选中的最帕: ${selected_hook}`;

      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: scriptSystemPrompt },
          { role: 'user', content: scriptUserPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      const aiResponse = response.choices[0].message?.content;

      if (!aiResponse) {
        return new Response(
          JSON.stringify({ error: 'AI 未返回有效内容' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 返回脚本内容（Markdown 格式）
      return new Response(JSON.stringify({ content: aiResponse }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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