import { NextResponse } from 'next/server';
import OSS from 'ali-oss';

export const runtime = 'nodejs';

// 环境变量
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;
const OSS_REGION = process.env.NEXT_PUBLIC_OSS_REGION!;
const OSS_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_OSS_ACCESS_KEY_ID!;
const OSS_ACCESS_KEY_SECRET = process.env.NEXT_PUBLIC_OSS_ACCESS_KEY_SECRET!;
const OSS_BUCKET = process.env.NEXT_PUBLIC_OSS_BUCKET!;

const ossClient = new OSS({
  region: OSS_REGION,
  accessKeyId: OSS_ACCESS_KEY_ID,
  accessKeySecret: OSS_ACCESS_KEY_SECRET,
  bucket: OSS_BUCKET,
  secure: true,
});

/**
 * 音色品牌化映射：前端名称 -> 阿里云 Voice ID
 * 支持 6 个核心品牌音色 (3男3女)
 */
const VOICE_NAME_MAP: Record<string, string> = {
  // 女声
  "雅雅": "longxiaochun",
  "小娩": "longxiaowan",
  "白白": "longyebai",
  // 男声
  "严选男声": "longcheng",
  "老铁": "longlaotie",
  "龙飞": "longfei",
};

/**
 * 解析音色ID：支持品牌名称或直接传入技术ID
 */
function resolveVoiceId(voiceInput: string): string {
  return VOICE_NAME_MAP[voiceInput] || voiceInput;
}

/**
 * 情感化文本预处理：将标签映射为能够引导 CosyVoice 情感起伏的标点
 */
function preprocessText(text: string): string {
  let processed = text;
  
  // 1. 过滤干扰合成的特殊符号
  processed = processed.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F3FB}-\u{1F3FF}\u{200D}\u{200B}\u{200E}\u{200F}\u{FE0F}\u{1F000}-\u{1F02B}\u{1F030}-\u{1F093}🎼]/gu, '');
  
  // 2. 情感映射 (利用标点符号控制 prosody)
  processed = processed.replace(/\[停顿\d+(ms|s)\]/g, '…… ');
  processed = processed.replace(/\[吸气\]/g, '，');
  processed = processed.replace(/\[(思考|叹气)\]/g, ' —— ');
  processed = processed.replace(/\[重读\]/g, '！');
  processed = processed.replace(/\[慢读\]/g, '…… ');
  
  // 3. 规范化处理
  processed = processed.replace(/？{2,}/g, '？');
  processed = processed.replace(/！{2,}/g, '！');
  processed = processed.replace(/。{2,}/g, '。');
  processed = processed.replace(/……{2,}/g, '……');
  
  return processed.trim();
}

/**
 * POST: 生成数字人口播视频
 * Body: { text: string, voice_id: string, video_url: string, model?: string }
 */
export async function POST(req: Request) {
  try {
    const { text, voice_id, video_url, model = "cosyvoice-v3-plus" } = await req.json();

    if (!text || !voice_id || !video_url) {
      return NextResponse.json({ error: "Missing parameters: text, voice_id, video_url required" }, { status: 400 });
    }

    const resolvedVoiceId = resolveVoiceId(voice_id);
    const processedText = preprocessText(text);
    
    // 1. 调用阿里云 TTS REST API (纯内存流处理，无磁盘IO)
    console.log("🎙️ Generating TTS via REST API...");
    const ttsResponse = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/synthesis",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
          "X-DashScope-Data-Inspection": "enable"
        },
        body: JSON.stringify({
          model: model,
          input: { text: processedText },
          parameters: { 
            voice: resolvedVoiceId,
            format: "mp3",
            sample_rate: 24000
          }
        })
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("TTS API Error Details:", errorText);
      throw new Error(`TTS API Error: ${errorText}`);
    }

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    // 使用 Buffer.from 显式创建内存 Buffer
    const audioBuffer = Buffer.from(audioArrayBuffer);
    const audioFilename = `gen_audio_${Date.now()}.mp3`;

    // 2. 上传音频到 阿里云 OSS (内存直传，彻底移除 fs 依赖)
    console.log("📦 Uploading audio to OSS (Memory Mode)...");
    await ossClient.put(audioFilename, audioBuffer);
    
    // 构造公网访问 URL
    const audio_final_url = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${audioFilename}`;
    console.log("✅ Audio uploaded to OSS:", audio_final_url);

    // 3. 调用 VideoRetalk API 合成视频 (Async)
    console.log("🎬 Calling VideoRetalk API...");
    const videoResponse = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable"
        },
        body: JSON.stringify({
          model: "videoretalk",
          input: { 
            video_url: video_url, 
            audio_url: audio_final_url 
          },
          parameters: { 
            video_extension: false 
          }
        })
      }
    );

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.error("VideoRetalk API Error Details:", errorText);
      throw new Error(`Aliyun VideoRetalk API Error: ${errorText}`);
    }
    
    const videoData = await videoResponse.json();
    return NextResponse.json({
      success: true,
      task_id: videoData.output?.task_id,
      audio_url: audio_final_url,
      ...videoData
    });

  } catch (error: any) {
    console.error("Generate Digital Video Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
