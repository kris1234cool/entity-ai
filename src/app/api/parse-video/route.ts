import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

// 配置 OpenAI 客户端，兼容 DeepSeek
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Step A: 从 APIHZ 提取视频 URL (使用 GET 请求 + 强力输入清洗)
async function extractVideoUrlFromAPIHZ(rawInput: string): Promise<string> {
  const apihzId = process.env.APIHZ_ID;
  const apihzKey = process.env.APIHZ_KEY;

  if (!apihzId || !apihzKey) {
    throw new Error('缺少 APIHZ 配置信息');
  }

  try {
    // ========== Step A1: 强力输入清洗 (Input Sanitization) ==========
    console.log('🔍 原始输入:', rawInput);
    
    // 正则提取 http/https 链接
    const urlMatch = rawInput.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      throw new Error('未检测到有效链接，请输入正确的视频 URL');
    }
    
    const cleanUrl = urlMatch[0].trim();
    console.log('✅ 清洗后的 URL:', cleanUrl);

    // ========== Step A2: 构造 GET 请求 URL ==========
    const targetUrl = `https://cn.apihz.cn/api/fun/douyin.php?id=${encodeURIComponent(apihzId)}&key=${encodeURIComponent(apihzKey)}&url=${encodeURIComponent(cleanUrl)}`;
    console.log('🌐 请求 URL:', targetUrl);

    // ========== Step A3: 发起 GET 请求 ==========
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`);
    }

    const data = await response.json();
    console.log('🔥 APIHZ Raw Response:', JSON.stringify(data));

    // ========== Step A4: 错误判断逻辑 ==========
    if (data.code === 200 && data.video) {
      console.log('✅ 成功提取视频 URL');
      return data.video;
    } else if (data.code === 200 && data.data && data.data.video) {
      // 兼容不同的响应格式
      console.log('✅ 成功提取视频 URL (格式2)');
      return data.data.video;
    } else {
      const errorMsg = data.msg || data.message || '接口未返回视频';
      throw new Error(`APIHZ 返回错误: ${errorMsg}`);
    }
  } catch (error) {
    console.error('❌ APIHZ API 错误:', error);
    throw new Error(`无法从 APIHZ 提取视频: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// Step B: 从 SiliconFlow 进行流式转录
async function transcribeVideoFromSiliconFlow(videoUrl: string): Promise<string> {
  const siliconflowApiKey = process.env.SILICONFLOW_API_KEY;

  if (!siliconflowApiKey) {
    throw new Error('缺少 SILICONFLOW_API_KEY');
  }

  try {
    // 获取 MP4 流
    console.log('📥 正在下载视频...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const videoRes = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!videoRes.ok) {
      throw new Error(`无法下载视频: ${videoRes.status}`);
    }

    // 获取 ArrayBuffer
    const arrayBuffer = await videoRes.arrayBuffer();
    const videoSize = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`✅ 视频下载完成: ${videoSize} MB`);

    // 创建 FormData
    const formData = new FormData();
    // ✅ 使用 audio/mpeg 类型和 .mp3 后缀，SiliconFlow 更好识别
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    formData.append('file', blob, 'audio.mp3');
    // ✅ 必须指定 model 参数，SiliconFlow API 必需
    formData.append('model', 'FunAudioLLM/SenseVoiceSmall');

    // 发送到 SiliconFlow
    console.log('🌐 正在上传到 SiliconFlow 进行转录...');
    console.log('📝 请求地址: https://api.siliconflow.cn/v1/audio/transcriptions');
    console.log('📦 文件大小:', blob.size, '字节');
    
    const transcriptionRes = await fetch(
      'https://api.siliconflow.cn/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${siliconflowApiKey}`,
        },
        body: formData,
      }
    );

    const contentType = transcriptionRes.headers.get('content-type');
    let transcriptionData;
    
    // ✅ 先读取响应体，无论状态码如何
    try {
      transcriptionData = await transcriptionRes.json();
      console.log(`🔥 SiliconFlow 原始响应:`, JSON.stringify(transcriptionData));
    } catch (e) {
      const textError = await transcriptionRes.text();
      console.error('❌ SiliconFlow 响应解析失败:', textError);
      throw new Error(`SiliconFlow 返回格式错误: ${textError}`);
    }

    // ✅ 直接检查 text 字段是否存在（SiliconFlow 直接返回 {"text": "..."}）
    if (transcriptionData.text) {
      console.log(`✅ 转录成功，文本长度: ${transcriptionData.text.length} 字符`);
      return transcriptionData.text;
    }
    
    // 如果没有 text 字段，才判定为失败
    console.error('❌ 未找到转录文本，完整响应:', JSON.stringify(transcriptionData));
    throw new Error(`SiliconFlow 未返回转录文本: ${JSON.stringify(transcriptionData)}`);
  } catch (error) {
    console.error('❌ SiliconFlow 转录错误:', error);
    throw new Error(
      `无法转录视频: ${error instanceof Error ? error.message : '未知错误'}`
    );
  }
}

// 生成爆款仿写内容
async function generateViralRewrite(
  extractedText: string,
  shopProfile: any
): Promise<string> {
  const prompt = `
你是一个短视频爆款内容专家。用户提供了一个热门视频的转录文本，需要你根据这个内容的结构、逻辑和表现手法进行仿写，创建一个适合${shopProfile.shop_name}(${shopProfile.category})的版本。

原始视频转录文本:
${extractedText}

店铺档案:
- 店铺名称: ${shopProfile.shop_name}
- 店铺类别: ${shopProfile.category}
- 目标客户: ${shopProfile.target_audience}
- 独特卖点: ${shopProfile.unique_selling_point}
- 老板人设: ${shopProfile.boss_persona}

任务要求:
1. 分析原始文本的钩子、冲突、转折、CTA 等关键要素
2. 保留这些元素的结构，但用店铺相关的内容进行替换
3. 确保文案符合短视频传播规律，有吸引力和转化力
4. 输出格式为 Markdown，包含:
   - 📝 分析: 原始视频的关键要素
   - 🎯 仿写脚本: 改编后的内容

请开始仿写:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个短视频流量专家和内容创作高手。你的任务是帮助实体店老板快速创作爆款内容。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiResponse = response.choices[0].message?.content;

    if (!aiResponse) {
      throw new Error('AI 未返回有效内容');
    }

    return aiResponse;
  } catch (error) {
    console.error('AI 生成错误:', error);
    throw new Error(
      `生成仿写内容失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, action, extractedText, shopProfile } = body;

    // ✅ 根据 action 类型进行不同的验证
    if (action === 'extract-and-transcribe') {
      // 这个 action 需要 videoUrl
      if (!videoUrl || !videoUrl.trim()) {
        return new Response(
          JSON.stringify({ error: '缺少视频 URL' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Step 1: 从 APIHZ 提取视频 URL
      console.log('Step 1: 从 APIHZ 提取视频 URL...');
      const mp4Url = await extractVideoUrlFromAPIHZ(videoUrl);

      // Step 2: 从 SiliconFlow 转录音频
      console.log('Step 2: 从 SiliconFlow 转录...');
      const extractedText = await transcribeVideoFromSiliconFlow(mp4Url);

      return new Response(
        JSON.stringify({
          success: true,
          extractedText,
          videoUrl: videoUrl,  // ✅ 关键：返回原始视频 URL 给前端
          mp4Url: mp4Url,      // ✅ 同时返回清洗后的 MP4 URL
          message: '视频转录成功',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (action === 'generate-rewrite') {
      // ✅ 这个 action 只需要 extractedText 和 shopProfile，不需要 videoUrl
      if (!extractedText || !shopProfile) {
        return new Response(
          JSON.stringify({ error: '缺少必要参数: extractedText, shopProfile' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 检查用户权限
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

      const isMember = userProfile?.membership_level === 'premium' || userProfile?.membership_level === 'enterprise';
      const membershipExpiry = userProfile?.membership_expire_at
        ? new Date(userProfile.membership_expire_at)
        : new Date();
      const isMembershipValid = isMember && membershipExpiry > new Date();

      // "爆款仿写"是 VIP 功能
      if (!isMembershipValid) {
        return new Response(
          JSON.stringify({
            error: '爆款仿写是 VIP 专属功能',
            message: '请升级为 VIP 会员获得此功能',
            shouldShowUpgradeDialog: true,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 生成仿写内容
      const rewriteContent = await generateViralRewrite(extractedText, shopProfile);

      return new Response(
        JSON.stringify({
          success: true,
          content: rewriteContent,
          message: '仿写内容生成成功',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: '无效的操作类型' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('API 错误:', error);

    let errorMessage = '处理请求时出现错误';
    if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
