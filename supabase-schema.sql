-- Supabase 数据库表结构初始化脚本

-- 创建 profiles 表 - 扩展 Auth 表，包含会员等级、过期时间、每日使用计数
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  membership_level TEXT DEFAULT 'free' CHECK (membership_level IN ('free', 'premium', 'enterprise')),
  membership_expire_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  daily_usage_count INTEGER DEFAULT 0,
  max_daily_usage INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 projects 表 - 存储店铺档案，user_id 关联
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  shop_name TEXT NOT NULL,
  category TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  unique_selling_point TEXT NOT NULL,
  boss_persona TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 generations 表 - 存储生成历史，结果存为 JSONB
CREATE TABLE IF NOT EXISTS generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id) NOT NULL,
  script_type TEXT NOT NULL CHECK (script_type IN ('人设故事', '进店理由', '观点输出', '口播', '爆款选题', '爆款仿写')),
  topic TEXT NOT NULL,
  conversion_goal TEXT NOT NULL CHECK (conversion_goal IN ('涨粉', '卖货', '信任')),
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 redeem_codes 表 - 存储卡密
CREATE TABLE IF NOT EXISTS redeem_codes (
  code TEXT PRIMARY KEY,
  membership_level TEXT NOT NULL CHECK (membership_level IN ('premium', 'enterprise')),
  validity_days INTEGER NOT NULL DEFAULT 30,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own generations" ON generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" ON generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own redeem_codes" ON redeem_codes
  FOR SELECT USING (auth.uid() = used_by);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 profiles 和 projects 表创建更新时间触发器
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 创建扩展以支持 UUID 生成
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建 user_digital_assets 表 - 存储用户数字人资产 (Voice ID 和默认视频)
CREATE TABLE IF NOT EXISTS user_digital_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,           -- 对应 clerk 或其他 auth 的 user_id
  voice_id TEXT,                    -- 复刻后的阿里云 Voice ID
  default_video_url TEXT,           -- 用户上传的默认底板视频 URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- 启用 RLS
ALTER TABLE user_digital_assets ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略 (允许所有操作，因为 user_id 是 TEXT 而非 auth.uid)
CREATE POLICY "Users can manage own digital assets" ON user_digital_assets
  FOR ALL USING (true);

-- 创建更新时间触发器
CREATE TRIGGER update_user_digital_assets_updated_at 
  BEFORE UPDATE ON user_digital_assets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 插入示例卡密（可选）
-- INSERT INTO redeem_codes (code, membership_level, validity_days) VALUES
-- ('PREMIUM2024', 'premium', 30),
-- ('ENTERPRISE2024', 'enterprise', 90);