# 快速开始指南

## 问题解决 ✅

已解决的问题：
1. ✅ 创建了缺失的 `src/lib/utils.ts` 工具文件
2. ✅ 安装了缺失的依赖：`clsx`、`tailwind-merge`、`class-variance-authority`
3. ✅ 更新了环境变量配置文件

## 如何访问网页

### 方法1：直接访问（推荐）
打开浏览器，访问以下地址之一：
- **本地访问**: http://localhost:3000
- **局域网访问**: http://192.168.110.136:3000

### 方法2：使用命令行
```bash
cd /Users/shenxin/Desktop/实体店编导/ai-copywriting-saas
npm run dev
```

然后在浏览器中打开 http://localhost:3000

## 页面导航

- **首页** (`/`) - AI脚本生成器
- **登录页** (`/login`) - 手机号验证码登录
- **个人中心** (`/profile`) - 会员管理和卡密激活

## 当前状态

✅ 项目已构建完成
✅ 开发服务器正在运行在 http://localhost:3000
⚠️ 需要配置真实的 Supabase 和 DeepSeek API 才能使用完整功能

## 下一步操作

### 1. 配置 Supabase（必需）
1. 访问 https://supabase.com 创建项目
2. 获取项目 URL 和 Anon Key
3. 编辑 `.env.local` 文件：
   ```
   NEXT_PUBLIC_SUPABASE_URL=你的_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_supabase_anon_key
   ```
4. 在 Supabase SQL Editor 中执行 `supabase-schema.sql` 文件

### 2. 配置 DeepSeek API（必需）
1. 访问 https://platform.deepseek.com 注册并获取 API Key
2. 编辑 `.env.local` 文件：
   ```
   OPENAI_API_KEY=你的_deepseek_api_key
   OPENAI_BASE_URL=https://api.deepseek.com
   ```

### 3. 重启服务器
配置完成后，重启开发服务器：
```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

## 开发模式功能

在开发模式下，即使没有配置 Supabase，您也可以：
- ✅ 查看所有页面和UI设计
- ✅ 测试表单交互
- ✅ 使用本地存储模拟用户登录和档案管理
- ⚠️ 但无法实际生成AI脚本（需要 DeepSeek API）

## 故障排除

### 如果页面无法打开
1. 检查终端是否有错误信息
2. 确认端口 3000 没有被其他程序占用
3. 尝试重启开发服务器

### 如果出现模块错误
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

### 如果需要清理缓存
```bash
# 清理 Next.js 缓存
rm -rf .next
npm run dev
```

## 技术支持

如有问题，请检查：
1. Node.js 版本 >= 18
2. npm 版本最新
3. 所有依赖已正确安装
4. 环境变量配置正确
