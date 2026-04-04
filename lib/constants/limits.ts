// 用户资源限制
export const LIMITS = {
  // 词汇表
  VOCABULARY_MAX_COUNT: 50,       // 每用户最多词汇表数量
  VOCABULARY_MAX_WORDS: 1000,     // 每个词汇表最多词汇数

  // 模板
  TEMPLATE_MAX_COUNT: 50,        // 每用户最多模板数量
  TEMPLATE_MAX_LENGTH: 5000,     // 每个模板最大字数

  // 密码
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
} as const
