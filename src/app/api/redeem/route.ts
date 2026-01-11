import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { code, phone } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: '请输入有效的卡密' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // 尝试从 Supabase 认证获取用户（传统模式）
    let userId: string | null = null;
    let userPhone: string = phone || '';
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (user && !authError) {
      // 如果有 Supabase 认证用户，使用该用户
      userId = user.id;
      userPhone = user.phone || phone || '';
    } else if (phone) {
      // 线索收集模式：使用手机号作为用户标识
      userId = `lead_${phone}`;
      userPhone = phone;
    } else {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 查询卡密信息
    const { data: redeemCode, error: queryError } = await supabase
      .from('redeem_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (queryError || !redeemCode) {
      return NextResponse.json(
        { error: '卡密不存在或已过期' },
        { status: 404 }
      );
    }

    // 检查是否已使用
    if (redeemCode.is_used) {
      return NextResponse.json(
        { error: '该卡密已被使用' },
        { status: 400 }
      );
    }

    // 获取或创建用户档案
    let { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // 如果档案不存在（新用户），则创建一个
    if (!userProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ 
          id: userId, 
          phone: userPhone,
          membership_level: 'free',
          max_daily_usage: 3,
          daily_usage_count: 0
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('创建用户档案失败:', createError);
        return NextResponse.json({ error: '初始化用户信息失败' }, { status: 500 });
      }
      userProfile = newProfile;
    }

    // 计算新的过期时间
    const currentExpiry = userProfile.membership_expire_at
      ? new Date(userProfile.membership_expire_at)
      : new Date();
    
    // 确保即使当前已过期，也从现在开始累加
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate);
    
    // 使用数据库中实际的字段名 'days'
    newExpiry.setDate(newExpiry.getDate() + (redeemCode.days || 30));

    // 更新用户会员信息
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_level: 'premium',
        membership_expire_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json(
        { error: '更新会员信息失败' },
        { status: 500 }
      );
    }

    // 标记卡密为已使用
    const { error: markError } = await supabase
      .from('redeem_codes')
      .update({
        is_used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq('code', code.toUpperCase());

    if (markError) {
      console.error('标记卡密失败:', markError);
      // 即使标记失败也返回成功，因为已更新了会员信息
    }

    return NextResponse.json(
      {
        success: true,
        message: `恭喜！您已成功兑换会员，有效期至 ${newExpiry.toLocaleDateString()}`,
        expiry: newExpiry.toISOString(),
        membershipLevel: 'premium',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('兑换码处理失败:', error);
    return NextResponse.json(
      { error: '处理失败，请稍后重试' },
      { status: 500 }
    );
  }
}
