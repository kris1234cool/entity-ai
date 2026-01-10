import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);
export const runtime = 'nodejs';

// 环境变量
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * GET: 获取当前用户的数字人资产
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_digital_assets')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    // PGRST116 表示未找到记录，不算错误
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log(`📦 GET assets for ${userId}:`, data?.default_video_url);
    return NextResponse.json({ assets: data || null });
  } catch (error: unknown) {
    console.error('GET Digital Assets Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 更新数字人资产 (视频或音频)
 * Body: { userId: string, type: 'video' | 'audio', url: string }
 */
export async function POST(req: Request) {
  try {
    const { userId, type, url } = await req.json();
    
    if (!userId || !type || !url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`📥 POST asset: userId=${userId}, type=${type}, url=${url.substring(0, 50)}...`);

    // 检查是否已存在记录 (不用 single，避免多条记录报错)
    const { data: existingList } = await supabase
      .from('user_digital_assets')
      .select('id, default_video_url, voice_id')
      .eq('user_id', userId);
    
    const existing = existingList && existingList.length > 0 ? existingList[0] : null;
    
    // 如果有多条记录，清理重复数据
    if (existingList && existingList.length > 1) {
      console.log(`⚠️ 发现 ${existingList.length} 条重复记录，清理中...`);
      // 保留第一条，删除其他
      const idsToDelete = existingList.slice(1).map(r => r.id);
      await supabase
        .from('user_digital_assets')
        .delete()
        .in('id', idsToDelete);
      console.log(`✅ 已清理 ${idsToDelete.length} 条重复记录`);
    }
    
    const updateData: Record<string, unknown> = { 
      user_id: userId, 
      updated_at: new Date().toISOString() 
    };

    if (type === 'video') {
      // 直接更新视频 URL
      updateData.default_video_url = url;
      // 保留原有的 voice_id
      if (existing?.voice_id) {
        updateData.voice_id = existing.voice_id;
      }
    } else if (type === 'audio') {
      // 调用 Python 脚本复刻 Voice ID
      const scriptPath = path.join(process.cwd(), 'scripts', 'enroll_voice.py');
      // prefix 只能包含英文字母和数字，移除所有特殊字符
      const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
      const prefix = `u${safeUserId.substring(0, 8)}`;
      const command = `python3 "${scriptPath}" "${url}" "${prefix}"`;
      
      console.log("🎙️ Enrolling Voice...");
      console.log("Command:", command);
      
      const { stdout, stderr } = await execPromise(command, { 
        env: { ...process.env, DASHSCOPE_API_KEY } 
      });
      
      console.log("stdout:", stdout);
      if (stderr) console.log("stderr:", stderr);
      
      if (!stdout.includes("SUCCESS:")) {
        throw new Error(`Voice Enrollment Failed: ${stderr || stdout}`);
      }
      
      // 解析输出 SUCCESS:voice_id
      const match = stdout.match(/SUCCESS:(.+)/);
      if (!match) {
        throw new Error("Invalid output from Python script");
      }
      updateData.voice_id = match[1].trim();
      // 保留原有的 video_url
      if (existing?.default_video_url) {
        updateData.default_video_url = existing.default_video_url;
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // 使用 upsert 确保数据一致性
    if (existing) {
      // 更新现有记录
      const { error } = await supabase
        .from('user_digital_assets')
        .update(updateData)
        .eq('id', existing.id);  // 用 id 而不是 user_id，更精确
      
      if (error) throw error;
    } else {
      // 插入新记录
      const { error } = await supabase
        .from('user_digital_assets')
        .insert(updateData);
      
      if (error) throw error;
    }
    
    console.log(`✅ Asset updated: type=${type}, url=${updateData.default_video_url || updateData.voice_id}`);
    
    return NextResponse.json({ 
      success: true, 
      voice_id: updateData.voice_id as string | undefined,
      video_url: updateData.default_video_url as string | undefined
    });

  } catch (error: unknown) {
    console.error("Asset Update Error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
