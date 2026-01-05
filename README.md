# 实体店AI文案助手

一个为实体店老板生成短视频脚本的SaaS工具（MVP版本）。

## 项目概述

这是一个移动端优先的实体店AI文案SaaS工具，旨在帮助实体店老板快速生成专业的短视频脚本，提升店铺曝光和转化率。

### 核心功能
- 用户注册/登录（手机号+验证码）
- 强制建档（店铺档案管理）
- 6种脚本类型生成（人设故事、进店理由、观点输出、口播、爆款选题、爆款仿写）
- 转化目标选择（涨粉/卖货/信任）
- 生成结果以分镜+台词卡片形式展示
- 付费卡密激活会员功能

### 技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS (Mobile First Design)
- **UI组件**: Shadcn/UI
- **数据库/认证**: Supabase
- **AI集成**: OpenAI Compatible SDK (接入DeepSeek)

## 快速开始

### 环境准备
1. 安装 Node.js (v18+)
2. 安装项目依赖：
```bash
npm install
```

### 环境变量配置
复制 `.env.local` 文件并填入相应配置：
```bash
cp .env.local .env.local.example
```

需要配置的环境变量：
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase项目URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase匿名密钥
- `OPENAI_API_KEY` - DeepSeek API密钥
- `OPENAI_BASE_URL` - DeepSeek API端点（https://api.deepseek.com）

### 数据库初始化
在Supabase控制台执行 `supabase-schema.sql` 文件中的SQL脚本以创建数据库表结构。

### 启动项目
```bash
npm run dev
```

## 项目结构

```
src/
├── app/                    # Next.js页面路由
│   ├── api/                # API路由
│   │   └── generate/       # AI生成API
│   ├── login/              # 登录页面
│   ├── profile/            # 个人中心页面
│   └── page.tsx            # 主页
├── components/             # React组件
│   ├── auth/               # 认证相关组件
│   ├── ui/                 # UI组件 (Shadcn)
│   ├── ProjectForm.tsx     # 档案录入表单
│   ├── ScriptCard.tsx      # 脚本展示卡片
│   └── ScriptGenerator.tsx # 脚本生成器
├── lib/                    # 工具库
│   └── prompts.ts          # AI提示词管理
├── types/                  # TypeScript类型定义
├── utils/                  # 工具函数
│   └── supabase/           # Supabase客户端配置
```

## 核心功能说明

### AI提示词架构
- 系统提示词：短视频流量专家角色设定
- 根据转化目标动态注入指令：
  - 涨粉：结尾增加互动提问或槽点
  - 卖货：结尾增加限时优惠和紧迫感
  - 信任：结尾增加售后承诺
- 严格JSON格式输出

### 移动端设计
- 采用深色模式作为默认风格
- 移动端优先设计，PC端内容居中显示在480px容器内

## 数据库设计

- `profiles`: 用户档案表，扩展Auth表，包含会员等级、过期时间、每日使用计数
- `projects`: 店铺档案表，存储用户填写的店铺信息
- `generations`: 生成历史表，存储AI生成结果
- `redeem_codes`: 卡密表，用于激活会员

## API接口

### POST /api/generate
生成短视频脚本
- 请求体：scriptType, conversionGoal, topic, shopProfile
- 响应：JSON格式的脚本内容

## 部署

1. 构建项目：
```bash
npm run build
```

2. 启动生产服务器：
```bash
npm start
```

## 开发说明

### 认证流程
- 使用Supabase Auth进行手机号验证码登录
- 通过AuthProvider管理认证状态

### AI集成
- 使用DeepSeek API进行脚本生成
- 严格按照JSON格式要求输出结果
- 根据用户选择的脚本类型和转化目标构建提示词

### 组件说明
- `ProjectForm`: 店铺档案录入表单
- `ScriptGenerator`: 脚本生成器组件
- `ScriptCard`: 脚本结果展示组件，支持复制和生成图片