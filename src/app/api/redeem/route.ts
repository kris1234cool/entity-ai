import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { mobile, code, deviceId } = await request.json();

    // 验证输入
    if (!mobile || !code || !deviceId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 检查卡密是否存在且未使用
    const { data: redeemCode, error: redeemError } = await supabase
      .from('redeem_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (redeemError || !redeemCode) {
      return NextResponse.json(
        { error: '卡密不存在或已失效' },
        { status: 404 }
      );
    }

    if (redeemCode.used) {
      return NextResponse.json(
        { error: '卡密已被使用' },
        { status: 400 }
      );
    }

    // 检查该设备是否已使用过此卡密
    const { data: existingLicense } = await supabase
      .from('license_keys')
      .select('*')
      .eq('device_id', deviceId)
      .eq('code', code)
      .single();

    if (existingLicense) {
      return NextResponse.json(
        { error: '该设备已使用过此卡密' },
        { status: 400 }
      );
    }

    // 计算过期时间
    const now = new Date();
    const expiresAt = new Date(now.getTime() + redeemCode.validity_days * 24 * 60 * 60 * 1000);

    // 创建 license_keys 记录
    const { error: licenseError } = await supabase
      .from('license_keys')
      .insert({
        device_id: deviceId,
        code,
        mobile,
        membership_level: redeemCode.membership_level,
        expires_at: expiresAt.toISOString(),
      });

    if (licenseError) {
      console.error('创建 license_keys 记录失败:', licenseError);
      return NextResponse.json(
        { error: '激活失败，请稍后重试' },
        { status: 500 }
      );
    }

    // 更新 redeem_codes 为已使用
    const { error: updateError } = await supabase
      .from('redeem_codes')
      .update({
        used: true,
        used_at: now.toISOString(),
      })
      .eq('code', code);

    if (updateError) {
      console.error('更新 redeem_codes 失败:', updateError);
    }

    // 将激活信息存储到 localStorage（通过响应体返回）
    return NextResponse.json(
      {
        success: true,
        message: '激活成功！',
        license: {
          membership_level: redeemCode.membership_level,
          expires_at: expiresAt.toISOString(),
          validity_days: redeemCode.validity_days,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API 错误:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
