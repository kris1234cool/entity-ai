// 脚本类型定义
export interface ScriptSegment {
  visual: string;      // 画面描述
  audio: string;       // 台词内容
  emotion: string;     // 情绪表达
}

export interface ScriptResult {
  title: string;       // 脚本标题
  cover_text: string;  // 封面文案
  script_list: ScriptSegment[]; // 分镜脚本列表
}

// 转化目标类型
export type ConversionGoal = '涨粉' | '卖货' | '信任';

// 脚本类型
export type ScriptType = '✨ 灵感一闪' | '进店理由' | '观点输出' | '口播' | '爆款选题' | '爆款仿写';

// 用户档案类型
export interface ShopProfile {
  id?: string;
  user_id: string;
  shop_name: string;
  category: string;
  target_audience: string;
  unique_selling_point: string;
  boss_persona: string;
}

// 生成记录类型
export interface GenerationRecord {
  id?: string;
  user_id: string;
  project_id: string;
  script_type: ScriptType;
  topic: string;
  conversion_goal: ConversionGoal;
  result: ScriptResult;
  created_at?: string;
}

// 用户会员信息
export interface UserProfile {
  id: string;
  phone: string;
  membership_level: 'free' | 'premium' | 'enterprise';
  membership_expire_at: string;
  daily_usage_count: number;
  max_daily_usage: number;
}

// 卡密类型
export interface RedeemCode {
  code: string;
  membership_level: 'premium' | 'enterprise';
  validity_days: number;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}