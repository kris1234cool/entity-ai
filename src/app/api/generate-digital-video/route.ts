import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);
export const runtime = 'nodejs';

// 环境变量
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * POST: 生成数字人口播视频
 * Body: { text: string, voice_id: string, video_url: string, model?: string }
 */
export async function POST(req: Request) {
  let localAudioPath: string | null = null;
  
  try {
    // 新增 model 参数 (默认 cosyvoice-v3-plus)
    const { text, voice_id, video_url, model = "cosyvoice-v3-plus" } = await req.json();

    if (!text || !voice_id || !video_url) {
      return NextResponse.json({ error: "Missing parameters: text, voice_id, video_url required" }, { status: 400 });
    }

    // 1. Python TTS 生成
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    localAudioPath = path.join(tempDir, `tts_${Date.now()}.mp3`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'tts_worker.py');
    
    // 调用 Python 时传入 model 参数
    const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const command = `python3 "${scriptPath}" "${safeText}" "${voice_id}" "${localAudioPath}" "${model}"`;
    
    console.log("🎙️ Generating TTS...");
    console.log("Command:", command);
    
    const { stdout, stderr } = await execPromise(command, { 
      env: { ...process.env, DASHSCOPE_API_KEY } 
    });
    
    console.log("TTS stdout:", stdout);
    if (stderr) console.log("TTS stderr:", stderr);

    if (!stdout.includes("SUCCESS") || !fs.existsSync(localAudioPath)) {
      throw new Error(`TTS Failed: ${stderr || stdout || 'No audio file created'}`);
    }

    // 2. 上传音频到 Supabase Storage
    const audioBuffer = fs.readFileSync(localAudioPath);
    const audioFilename = `gen_audio_${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(audioFilename, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });
    
    // 清理临时文件
    fs.unlinkSync(localAudioPath);
    localAudioPath = null;
    
    if (uploadError) {
      throw new Error(`Audio Upload Error: ${uploadError.message}`);
    }
    
    const audio_final_url = `${SUPABASE_URL}/storage/v1/object/public/assets/${audioFilename}`;
    console.log("📦 Audio uploaded:", audio_final_url);

    // 3. 调用 VideoRetalk API 合成视频
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
      throw new Error(`Aliyun VideoRetalk API Error: ${errorText}`);
    }
    
    const videoData = await videoResponse.json();
    console.log("✅ VideoRetalk response:", JSON.stringify(videoData, null, 2));
    
    return NextResponse.json({
      success: true,
      task_id: videoData.output?.task_id,
      audio_url: audio_final_url,
      ...videoData
    });

  } catch (error: unknown) {
    // 清理临时文件
    if (localAudioPath && fs.existsSync(localAudioPath)) {
      fs.unlinkSync(localAudioPath);
    }
    
    console.error("Generate Digital Video Error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
