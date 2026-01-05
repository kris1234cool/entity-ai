// AI 提示词模块
export const SYSTEM_PROMPT = `你是一个短视频流量专家。你的客户是实体店老板。
你的任务是根据用户的[店铺档案]和[转化目标]，生成分镜脚本。
风格要求：拒绝废话，多用短句，开头必须由钩子(Hook)。
输出格式：必须是严格的 JSON 格式，包含 title, cover_text, script_list [{ visual, audio, emotion }]`;

export const getConversionGoalInstruction = (goal: string) => {
  switch (goal) {
    case '涨粉':
      return '结尾增加互动提问或槽点，引导用户评论关注。';
    case '卖货':
      return '结尾增加限时优惠和紧迫感，促进购买转化。';
    case '信任':
      return '结尾增加售后承诺，建立用户信任。';
    default:
      return '';
  }
};

export const getScriptTypePrompt = (type: string) => {
  switch (type) {
    case '人设故事':
      return '生成个人品牌故事，突出老板的人格魅力和专业背景。';
    case '进店理由':
      return '生成吸引顾客到店的理由，强调独特价值和体验。';
    case '观点输出':
      return '生成行业观点或见解，展示专业度和权威性。';
    case '口播':
      return '生成直接的口播文案，简洁有力地传达核心信息。';
    case '爆款选题':
      return '生成热门话题相关的选题，具备传播潜力。';
    case '爆款仿写':
      return '仿写热门内容的结构和风格，保持核心要素。';
    default:
      return '';
  }
};