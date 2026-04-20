export type Lang = "en" | "zh";

export const T = {
  en: {
    // Onboarding
    heroTitle: "Hatch Your Crypto",
    heroTitleHighlight: "Trading Pet",
    heroSub: "It reads your wallet, watches your trades, and grows with every on-chain move 🚀",
    pickEgg: "Choose Your Egg",
    pinkEggLabel: "Pink Egg 🌸",
    pinkEggSub: "Warm & Cute",
    blueEggLabel: "Blue Egg 💙",
    blueEggSub: "Cool & Rational",
    petNameLabel: "Pet Name ✏️",
    petNamePlaceholder: "e.g. Mochi, CryptoFox, HODL Bunny",
    personalityLabel: "Personality 💬",
    personalityCustomPlaceholder: "Describe your pet's vibe...",
    goalsLabel: "Trading Goals 🎯",
    goalsOptional: "(pick up to 2)",
    goalCustomPlaceholder: "Or type your own goal...",
    hatchBtn: "🥚 Hatch Now!",
    builtOn: "Built on four.meme × BSC 🔗",
    hatching: "Hatching",
    hatchingSub: "AI is giving it a soul ✨",
    errorName: "Give your pet a name first 🐾",
    errorPersonality: "Describe your pet's personality ✨",
    errorFailed: "Hatching failed, please retry 😢",

    // Preset personalities
    personalities: [
      { label: "Sarcastic Coach 🦊", value: "Brutally honest, sarcastic, but secretly caring. Calls out bad trades with dry humor." },
      { label: "Hype Friend 🐶", value: "Always energetic and supportive. Celebrates every win, softens every loss with memes." },
      { label: "Wise Sensei 🦉", value: "Calm and analytical. Gives measured advice based on data, never panics." },
      { label: "Custom ✏️", value: "__custom__" },
    ],

    // Preset goals
    presetGoals: [
      "Hold any token for at least 2 weeks",
      "No panic selling — stick to my plan",
      "Only buy coins I've researched",
      "Review pumps before aping in",
      "Write down my exit plan before every trade",
    ],

    // Chat
    connectWallet: "🔗 Connect Wallet",
    todayRankings: "🔥 Hot Today",
    dailyCheckin: "✅ Check In",
    behaviorAnalysis: "📊 My Patterns",
    mintIdentity: "⛓ Mint Identity",
    minting: "Minting...",
    sendPlaceholder: "Talk to",
    send: "Send",
    resetTitle: "Reset pet",
    onChainBadge: "⛓ Agent #",
    onChainVerify: "on-chain verified",
    rankingPrompt: (lines: string) =>
      `Today's four.meme Hot Top5:\n${lines}\n\nComment on these coins in your personality. Connect to my trading goals. Keep it under 80 words.`,
    checkinMsg: "I completed my daily check-in and stayed on track today!",
    analysisMsg: "Analyze my recent trading behavior and tell me what to improve.",
  },

  zh: {
    heroTitle: "孵化你的专属",
    heroTitleHighlight: "Meme Trading Pet",
    heroSub: "它读你的链上记录，陪你看盘，并随着每次交易一起成长 🚀",
    pickEgg: "选择你的宠物蛋",
    pinkEggLabel: "粉色蛋 🌸",
    pinkEggSub: "温柔可爱型",
    blueEggLabel: "蓝色蛋 💙",
    blueEggSub: "酷帅理性型",
    petNameLabel: "宠物名字 ✏️",
    petNamePlaceholder: "例如：毛毛、Crypto猫、HODL兔",
    personalityLabel: "性格描述 💬",
    personalityCustomPlaceholder: "描述你的宠物的性格...",
    goalsLabel: "Trading 目标 🎯",
    goalsOptional: "（最多选2个）",
    goalCustomPlaceholder: "或者输入自定义目标...",
    hatchBtn: "🥚 开始孵化！",
    builtOn: "Built on four.meme × BSC 🔗",
    hatching: "正在孵化",
    hatchingSub: "AI正在赋予灵魂 ✨",
    errorName: "给你的宠物起个名字吧 🐾",
    errorPersonality: "描述一下宠物的性格吧 ✨",
    errorFailed: "创建失败，请重试 😢",

    personalities: [
      { label: "毒舌教练 🦊", value: "毒舌但关心我，用干幽默指出坏交易，在我赚钱时比我还开心。" },
      { label: "热血伙伴 🐶", value: "永远元气满满，为每次盈利欢呼，用梗图化解每次亏损。" },
      { label: "智慧导师 🦉", value: "冷静理性，用数据说话，从不慌乱，给出有依据的建议。" },
      { label: "自定义 ✏️", value: "__custom__" },
    ],

    presetGoals: [
      "持仓超过2周，不恐慌卖出",
      "不追高，不买没研究过的币",
      "每次交易前设置止损",
      "深夜打狗前先复盘一遍",
      "每天只看一次行情",
    ],

    connectWallet: "🔗 连接钱包",
    todayRankings: "🔥 今日热榜",
    dailyCheckin: "✅ 每日打卡",
    behaviorAnalysis: "📊 行为分析",
    mintIdentity: "⛓ 铸造链上身份",
    minting: "铸造中...",
    sendPlaceholder: "跟",
    send: "发送",
    resetTitle: "重置宠物",
    onChainBadge: "⛓ Agent #",
    onChainVerify: "链上身份已认证",
    rankingPrompt: (lines: string) =>
      `今天 four.meme 热榜 Top5:\n${lines}\n\n请用你的性格对这些币评论，结合我的交易目标，控制在80字以内（中文）。`,
    checkinMsg: "我今天完成了打卡，坚持了我的目标！",
    analysisMsg: "分析一下我最近的交易行为，告诉我有什么需要改进的？",
  },
} as const;

export type Strings = typeof T.en;
