import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;

/**
 * GET: 查询阿里云视频生成任务状态
 * Query: ?taskId=xxx
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { 
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}` 
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`📊 Task ${taskId} status:`, data.output?.task_status);
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Check Task Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
