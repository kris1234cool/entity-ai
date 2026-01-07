# AI文案助手 - 更新日志

## V2.0 上线：灵感一闪+卡密解锁 (2026-01-07)

### 🎯 核心功能

#### Freemium 模式
- **✨ 灵感一闪**：免费功能，所有用户可用，金色高亮显示
- **🔒 VIP 功能**：进店理由、观点输出、口播、爆款选题、爆款仿写（需解锁）
- 锁定功能显示灰色样式 + 🔒 图标
- 点击锁定功能提示"请解锁 VIP 畅享全能导演模式！"

#### 卡密兑换系统
- 支持手机号 + 卡密绑定
- 兑换成功后自动刷新会员状态
- 会员状态存储在 Supabase 数据库
- 跨设备同步：同一手机号在不同设备登录可共享会员权益

#### 会员等级
- **FREE**：仅可使用"灵感一闪"功能
- **VIP/Premium**：解锁全部 6 种脚本类型

### 🛠 技术改进

#### 认证系统
- 线索收集模式：手机号直接登录，无需验证码
- 用户 ID 格式：`lead_手机号`
- 会员状态从数据库实时获取

#### 数据库结构
- `profiles` 表：存储用户会员信息（id, phone, membership_level, membership_expire_at）
- `redeem_codes` 表：存储卡密（code, days, is_used, used_by, used_at）
- RLS 策略：允许查询未使用卡密、允许更新卡密状态

### 📁 主要文件变更
- `src/lib/agent-config.ts` - 重命名"人设故事"为"✨ 灵感一闪"
- `src/app/dashboard/page.tsx` - 实现 Freemium UI 和动态解锁
- `src/components/auth/AuthWrapper.tsx` - 添加数据库 profile 获取和 refreshProfile
- `src/components/MembershipCard.tsx` - 兑换后刷新会员状态
- `src/app/api/redeem/route.ts` - 支持手机号模式兑换卡密
- `src/types/index.ts` - 更新 ScriptType 类型

---

## V1.0 初始版本

- 基础 AI 文案生成功能
- 6 种脚本类型
- 店铺档案管理
- 手机号登录
