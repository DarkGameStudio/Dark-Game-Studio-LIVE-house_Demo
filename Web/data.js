/* ------------------------------------------------------------------
   LIVE HOUSE · 24H 元宇宙游戏情报站 —— 内容数据
   说明：以下均为演示占位数据（价格 / 热度 / 日期仅作排版样张），
        接入真实数据时保持字段结构不变即可。
   ------------------------------------------------------------------ */
window.LIVE_DATA = {
  meta: {
    segmentMinutes: 30,       // 每段时长（分钟）
    cycleHours: 24,           // 全天循环
    timeZone: "Asia/Shanghai",
    channel: "Dark Game Studio",   // 频道名：B 站直播间 / OBS 标题统一使用
    demoBadge: false,         // 页脚显示 DEMO 提示，替换真实数据后可设为 false
    bilibili: {
      roomId: "",             // 直播间号：填写后自动轮询 B 站直播 API，也可用 URL ?room=123
      anchor: "Dark Game Studio",  // 主播昵称，可留空
      api: true               // true 开启 B 站直播 API（开播状态/人气/粉丝）；false 仅本地模拟
    }
  },

  order: ["steam", "nintendo", "ps"],

  platforms: {
    steam: {
      name: "STEAM", cn: "蒸汽平台", code: "ST",
      color: "#66c0f4", soft: "rgba(102,192,244,.16)",
      metricLabel: "今日峰值",
      archive: [
        { src: "Steam Frame Machine.jpg", cap: "STEAM HARDWARE", year: "VALVE" },
        { src: "Steam logo.png", cap: "STEAM", year: "SINCE 2003" }
      ]
    },
    nintendo: {
      name: "NINTENDO", cn: "任天堂", code: "NS",
      color: "#ff4d60", soft: "rgba(255,77,96,.16)",
      metricLabel: "全球销量",
      archive: [
        { src: "nintendo switch.jpg", cap: "NINTENDO SWITCH", year: "2017" },
        { src: "red white machine.jpg", cap: "FAMICOM / NES", year: "1983" }
      ]
    },
    ps: {
      name: "PLAYSTATION", cn: "PlayStation", code: "PS",
      color: "#4b8dff", soft: "rgba(75,141,255,.16)",
      metricLabel: "周热度",
      archive: [
        { src: "PLAYSTATION PS5 PRO.png", cap: "PLAYSTATION 5 PRO", year: "2024" },
        { src: "PS.jpg", cap: "PLAYSTATION 5", year: "2020" }
      ]
    }
  },

  entries: {

    /* ============================== STEAM ============================== */
    steam: [
      { id: "st-cs2", title: "Counter-Strike 2", sub: "反恐精英 2", genre: "战术射击 · 竞技", status: "热游榜首", date: "2023.09.27", price: "免费", metric: "1,204,331", note: "起源二引擎重做烟雾与光影，5v5 的每一颗道具都在算经济账。", tags: ["联机", "电竞", "免费"] },
      { id: "st-dota", title: "Dota 2", sub: "刀塔 2", genre: "MOBA · 竞技", status: "常青榜单", date: "2013.07.09", price: "免费", metric: "812,904", note: "一百多位英雄与无限出装流派，国际邀请赛的常驻主场。", tags: ["联机", "策略", "免费"] },
      { id: "st-pubg", title: "PUBG: BATTLEGROUNDS", sub: "绝地求生", genre: "大逃杀 · 生存", status: "热游榜 #3", date: "2017.12.20", price: "免费", metric: "621,470", note: "百人空降海岛，缩圈节奏决定每一局的生死线。", tags: ["联机", "射击", "免费"] },
      { id: "st-elden", title: "ELDEN RING", sub: "艾尔登法环", genre: "动作 · 魂系", status: "口碑佳作", date: "2022.02.25", price: "¥298", metric: "953,426", note: "开放世界与高难度战斗叠加，交界地没有路标，只有传说。", tags: ["开放世界", "硬核", "联机"] },
      { id: "st-bg3", title: "Baldur's Gate 3", sub: "博德之门 3", genre: "CRPG · 剧情", status: "年度提名", date: "2023.08.03", price: "¥298", metric: "875,343", note: "每一个骰子都能改写剧情，队友也会记住你的选择。", tags: ["剧情", "回合制", "联机"] },
      { id: "st-cyber", title: "Cyberpunk 2077", sub: "赛博朋克 2077", genre: "开放世界 · RPG", status: "长销榜单", date: "2020.12.10", price: "¥298", metric: "1,054,381", note: "夜之城的霓虹与义体改造，2.0 版本后完全换了打法。", tags: ["开放世界", "科幻", "单人"] },
      { id: "st-wukong", title: "Black Myth: Wukong", sub: "黑神话：悟空", genre: "动作 · 神话", status: "国产热榜", date: "2024.08.20", price: "¥268", metric: "2,404,896", note: "棍法七十二变，实机演出把东方神话搬进次世代。", tags: ["动作", "西游", "单人"] },
      { id: "st-pal", title: "Palworld", sub: "幻兽帕鲁", genre: "生存 · 抓宠", status: "联机推荐", date: "2024.01.19", price: "¥108", metric: "2,101,867", note: "打工帕鲁与枪械共存，建造与探索都不设上限。", tags: ["联机", "建造", "生存"] },
      { id: "st-stardew", title: "Stardew Valley", sub: "星露谷物语", genre: "模拟 · 农场", status: "治愈榜首", date: "2016.02.26", price: "¥48", metric: "236,614", note: "一个人做的农场宇宙，四季作息比现实还准时。", tags: ["模拟", "治愈", "联机"] },
      { id: "st-hk", title: "Hollow Knight", sub: "空洞骑士", genre: "银河城 · 手绘", status: "史低特惠", date: "2017.02.24", price: "¥48", metric: "72,158", note: "圣巢的每一条支路，都藏着一段被遗忘的王国史。", tags: ["横版", "硬核", "单人"] },
      { id: "st-hades2", title: "Hades II", sub: "哈迪斯 II", genre: "动作 · 肉鸽", status: "抢先体验", date: "2024.05.06", price: "¥108", metric: "103,642", note: "冥界巫术加持，每一次死亡都把剧情往前推一格。", tags: ["肉鸽", "动作", "单人"] },
      { id: "st-sat", title: "Satisfactory", sub: "幸福工厂", genre: "工厂 · 建造", status: "硬核推荐", date: "2024.09.10", price: "¥136", metric: "187,540", note: "从一条传送带起步，最后把整颗星球改造成流水线。", tags: ["建造", "自动化", "联机"] },
      { id: "st-nms", title: "No Man's Sky", sub: "无人深空", genre: "太空 · 探索", status: "长更传奇", date: "2016.08.12", price: "¥218", metric: "212,604", note: "一百八十亿亿颗星球共享一个永远在更新的宇宙。", tags: ["太空", "探索", "联机"] },
      { id: "st-tf2", title: "Team Fortress 2", sub: "军团要塞 2", genre: "竞技 · 射击", status: "经典常驻", date: "2007.10.10", price: "免费", metric: "253,089", note: "九种职业、二十年的地图池，休闲服的快乐从未下线。", tags: ["联机", "经典", "免费"] },
      { id: "st-rust", title: "Rust", sub: "腐蚀", genre: "生存 · 沙盒", status: "周更榜单", date: "2018.02.08", price: "¥136", metric: "245,791", note: "从石头到火箭筒，一周一次清档让所有恩怨重开。", tags: ["联机", "生存", "沙盒"] },
      { id: "st-gta5", title: "Grand Theft Auto V", sub: "侠盗猎车手 V", genre: "开放世界 · 犯罪", status: "常青榜首", date: "2013.09.17", price: "¥179", metric: "364,548", note: "洛圣都的线上模式，已经长成了一个独立的小世界。", tags: ["开放世界", "联机", "经典"] },
      { id: "st-rdr2", title: "Red Dead Redemption 2", sub: "荒野大镖客 2", genre: "西部 · 剧情", status: "口碑佳作", date: "2019.12.05", price: "¥279", metric: "92,806", note: "慢节奏的西部史诗，马背上的每一段路都有天气。", tags: ["剧情", "开放世界", "单人"] },
      { id: "st-lethal", title: "Lethal Company", sub: "致命公司", genre: "合作 · 恐怖", status: "联机推荐", date: "2023.10.23", price: "¥42", metric: "240,655", note: "四个人、一支手电、一份永远填不满的配额。", tags: ["联机", "恐怖", "低价"] },
      { id: "st-apex", title: "Apex Legends", sub: "Apex 英雄", genre: "战术竞技 · 射击", status: "热游榜单", date: "2020.11.05", price: "免费", metric: "624,473", note: "传奇技能与滑铲身法叠加，三人小队的节奏快到没有空档。", tags: ["联机", "射击", "免费"] },
      { id: "st-terraria", title: "Terraria", sub: "泰拉瑞亚", genre: "沙盒 · 冒险", status: "史低特惠", date: "2011.05.16", price: "¥36", metric: "172,619", note: "2D 像素里塞进了挖矿、建造、Boss 与一整套装备树。", tags: ["沙盒", "联机", "像素"] }
    ],

    /* ============================= NINTENDO ============================ */
    nintendo: [
      { id: "ns-totk", title: "塞尔达传说 王国之泪", sub: "The Legend of Zelda: Tears of the Kingdom", genre: "开放世界 · 冒险", status: "年度推荐", date: "2023.05.12", price: "¥499", metric: "2,100 万", note: "究极手把一切物件变成零件，天空与地底都是谜题。", tags: ["开放世界", "解谜", "单人"] },
      { id: "ns-odyssey", title: "超级马力欧 奥德赛", sub: "Super Mario Odyssey", genre: "3D 平台 · 冒险", status: "口碑榜首", date: "2017.10.27", price: "¥429", metric: "2,900 万", note: "帽子附身万物，都市国度的每一层都在教新玩法。", tags: ["平台跳跃", "收集", "双人"] },
      { id: "ns-mk8", title: "马力欧卡丁车 8 豪华版", sub: "Mario Kart 8 Deluxe", genre: "竞速 · 派对", status: "常青榜首", date: "2017.04.28", price: "¥429", metric: "6,900 万", note: "48 条赛道与道具混战，客厅四人分屏的保留节目。", tags: ["竞速", "派对", "本地联机"] },
      { id: "ns-splatoon3", title: "斯普拉遁 3", sub: "Splatoon 3", genre: "射击 · 联机", status: "联机榜首", date: "2022.09.09", price: "¥429", metric: "1,200 万", note: "涂地比击倒更重要，打工模式考验四人心跳同步。", tags: ["联机", "射击", "排位"] },
      { id: "ns-acnh", title: "集合啦！动物森友会", sub: "Animal Crossing: New Horizons", genre: "生活 · 模拟", status: "治愈榜首", date: "2020.03.20", price: "¥429", metric: "4,800 万", note: "无人岛按真实时间流转，邻居会记得你多久没上线。", tags: ["模拟", "治愈", "联机"] },
      { id: "ns-pikmin4", title: "皮克敏 4", sub: "Pikmin 4", genre: "策略 · 探索", status: "口碑佳作", date: "2023.07.21", price: "¥429", metric: "350 万", note: "带着会开花的小队搬家，一天之内规划整颗星球。", tags: ["策略", "探索", "单人"] },
      { id: "ns-xc3", title: "异度神剑 3", sub: "Xenoblade Chronicles 3", genre: "JRPG · 剧情", status: "剧情榜首", date: "2022.07.29", price: "¥429", metric: "190 万", note: "六个角色、两个世界，把少年漫画式的哲学讲到底。", tags: ["剧情", "长流程", "单人"] },
      { id: "ns-fe", title: "火焰纹章 结合", sub: "Fire Emblem Engage", genre: "战棋 · 策略", status: "策略榜单", date: "2023.01.20", price: "¥429", metric: "160 万", note: "历代英雄以纹章身份回归，棋盘上每一步都要算两次。", tags: ["战棋", "策略", "单人"] },
      { id: "ns-kirby", title: "星之卡比 探索发现", sub: "Kirby and the Forgotten Land", genre: "动作 · 平台", status: "治愈推荐", date: "2022.03.25", price: "¥429", metric: "800 万", note: "塞满嘴的变形能力，让 3D 关卡永远保持轻松。", tags: ["平台跳跃", "双人", "治愈"] },
      { id: "ns-metroid", title: "密特罗德 生存恐惧", sub: "Metroid Dread", genre: "银河城 · 动作", status: "硬核推荐", date: "2021.10.08", price: "¥429", metric: "300 万", note: "流畅到像作弊的移动手感，追猎者永远在下一扇门后。", tags: ["硬核", "探索", "单人"] },
      { id: "ns-wonder", title: "超级马力欧 兄弟 惊奇", sub: "Super Mario Bros. Wonder", genre: "平台 · 合作", status: "年度推荐", date: "2023.10.20", price: "¥429", metric: "1,600 万", note: "惊奇花一开，整个关卡的规则当场改写。", tags: ["平台跳跃", "合作", "本地联机"] },
      { id: "ns-pokemon", title: "宝可梦 朱／紫", sub: "Pokémon Scarlet / Violet", genre: "RPG · 收集", status: "销量榜首", date: "2022.11.18", price: "¥429", metric: "2,600 万", note: "开放世界的第一作，四条主线可以任选顺序推进。", tags: ["收集", "联机", "冒险"] },
      { id: "ns-smash", title: "任天堂明星大乱斗 特别版", sub: "Super Smash Bros. Ultimate", genre: "格斗 · 派对", status: "常青榜单", date: "2018.12.07", price: "¥429", metric: "3,600 万", note: "八十多位斗士，从休闲到竞技只差一个道具开关。", tags: ["格斗", "派对", "本地联机"] },
      { id: "ns-luigi", title: "路易吉洋馆 3", sub: "Luigi's Mansion 3", genre: "冒险 · 解谜", status: "解谜推荐", date: "2019.10.31", price: "¥429", metric: "1,400 万", note: "吸尘器抓鬼，层层酒店各有自己的机关主题。", tags: ["解谜", "双人", "冒险"] },
      { id: "ns-bayo3", title: "猎天使魔女 3", sub: "Bayonetta 3", genre: "动作 · 华丽", status: "动作榜单", date: "2022.10.28", price: "¥429", metric: "110 万", note: "召唤魔兽与连段切换，把爽快感堆到屏幕之外。", tags: ["动作", "硬核", "单人"] },
      { id: "ns-botw", title: "塞尔达传说 旷野之息", sub: "The Legend of Zelda: Breath of the Wild", genre: "开放世界 · 冒险", status: "殿堂榜首", date: "2017.03.03", price: "¥499", metric: "3,200 万", note: "定义了现代开放世界：看到哪里，就能走到哪里。", tags: ["开放世界", "探索", "单人"] },
      { id: "ns-mparty", title: "马力欧派对 超级巨星", sub: "Mario Party Superstars", genre: "派对 · 合家欢", status: "派对榜首", date: "2021.10.29", price: "¥429", metric: "500 万", note: "百张经典棋盘回归，骰子决定友情能撑几回合。", tags: ["派对", "本地联机", "合家欢"] },
      { id: "ns-paper", title: "纸片马力欧 千年之门", sub: "Paper Mario: The Thousand-Year Door", genre: "RPG · 纸艺", status: "复刻推荐", date: "2024.05.23", price: "¥429", metric: "200 万", note: "纸片剧场式演出，每个 NPC 都值得聊上两句。", tags: ["RPG", "剧情", "单人"] },
      { id: "ns-skyward", title: "塞尔达传说 御天之剑 HD", sub: "Skyward Sword HD", genre: "动作 · 解谜", status: "复刻推荐", date: "2021.07.16", price: "¥429", metric: "400 万", note: "系列时间线的起点，体感剑术在这版改成摇杆也能玩。", tags: ["解谜", "冒险", "单人"] },
      { id: "ns-xc1", title: "异度神剑 终极版", sub: "Xenoblade Chronicles: Definitive Edition", genre: "JRPG · 剧情", status: "剧情佳作", date: "2020.05.29", price: "¥429", metric: "190 万", note: "巨神与机神两具躯体之上，装着一整部少年冒险史。", tags: ["剧情", "长流程", "单人"] }
    ],

    /* =========================== PLAYSTATION ========================== */
    ps: [
      { id: "ps-gow", title: "战神 诸神黄昏", sub: "God of War Ragnarök", genre: "动作 · 剧情", status: "年度推荐", date: "2022.11.09", price: "¥468", metric: "98.2", note: "父子横跨九界，一镜到底把北欧神话收束成家族故事。", tags: ["剧情", "动作", "单人"] },
      { id: "ps-sm2", title: "漫威蜘蛛侠 2", sub: "Marvel's Spider-Man 2", genre: "开放世界 · 动作", status: "热销榜首", date: "2023.10.20", price: "¥468", metric: "96.8", note: "双主角无缝切换，纽约的荡索速度再快一档。", tags: ["开放世界", "动作", "单人"] },
      { id: "ps-hfw", title: "地平线 西之绝境", sub: "Horizon Forbidden West", genre: "开放世界 · 冒险", status: "画面榜首", date: "2022.02.18", price: "¥468", metric: "94.6", note: "机械兽生态自成体系，每场战斗都像拆解一台巨型机器。", tags: ["开放世界", "画面", "单人"] },
      { id: "ps-ghost", title: "对马岛之魂", sub: "Ghost of Tsushima", genre: "开放世界 · 武士", status: "口碑榜首", date: "2020.07.17", price: "¥398", metric: "93.4", note: "黑泽明模式下的风与落叶，把剑戟片做成了可玩的分镜。", tags: ["武士", "开放世界", "单人"] },
      { id: "ps-tlou2", title: "最后生还者 第二部", sub: "The Last of Us Part II", genre: "剧情 · 生存", status: "剧情榜首", date: "2020.06.19", price: "¥398", metric: "92.7", note: "复仇与代价的双线叙事，每一场遭遇都写满人性。", tags: ["剧情", "生存", "单人"] },
      { id: "ps-ds2", title: "死亡搁浅 2", sub: "Death Stranding 2: On the Beach", genre: "开放世界 · 配送", status: "话题榜首", date: "2025.06.26", price: "¥468", metric: "91.5", note: "用绳索与滑索重新丈量大陆，孤独也能变成连接。", tags: ["开放世界", "剧情", "单人"] },
      { id: "ps-astro", title: "宇宙机器人", sub: "Astro Bot", genre: "平台 · 创意", status: "年度推荐", date: "2024.09.06", price: "¥398", metric: "95.9", note: "手柄就是关卡的一部分，每一关都在致敬 PlayStation 的三十年。", tags: ["平台跳跃", "创意", "单人"] },
      { id: "ps-ff7r2", title: "最终幻想 VII 重生", sub: "Final Fantasy VII Rebirth", genre: "JRPG · 剧情", status: "剧情榜单", date: "2024.02.29", price: "¥568", metric: "94.1", note: "米德加之外的世界全面打开，金碟游乐场也回来了。", tags: ["剧情", "长流程", "单人"] },
      { id: "ps-nightreign", title: "艾尔登法环 黑夜君临", sub: "Elden Ring Nightreign", genre: "联机 · 肉鸽", status: "新作上线", date: "2025.05.30", price: "¥218", metric: "89.8", note: "三人协作、三天循环，把交界地压缩成一场限时围猎。", tags: ["联机", "肉鸽", "硬核"] },
      { id: "ps-hd2", title: "地狱潜者 2", sub: "Helldivers 2", genre: "联机 · 射击", status: "联机榜首", date: "2024.02.08", price: "¥308", metric: "97.3", note: "银河战争由全服共同推进，友军火力永远是最危险的敌人。", tags: ["联机", "射击", "合作"] },
      { id: "ps-sh2", title: "寂静岭 2 重制版", sub: "Silent Hill 2", genre: "恐怖 · 剧情", status: "恐怖榜首", date: "2024.10.08", price: "¥398", metric: "90.6", note: "雾与心理恐怖同步升级，三角头的脚步声重新录过。", tags: ["恐怖", "剧情", "单人"] },
      { id: "ps-re4", title: "生化危机 4 重制版", sub: "Resident Evil 4", genre: "生存 · 动作", status: "口碑佳作", date: "2023.03.24", price: "¥398", metric: "93.9", note: "村庄围攻的节奏被重新编排，匕首也能撑起一套打法。", tags: ["生存", "动作", "单人"] },
      { id: "ps-ratchet", title: "瑞奇与叮当 时空跳转", sub: "Ratchet & Clank: Rift Apart", genre: "动作 · 平台", status: "画面推荐", date: "2021.06.11", price: "¥398", metric: "91.2", note: "次世代 SSD 的招牌演示，裂缝切换几乎没有等待。", tags: ["动作", "画面", "单人"] },
      { id: "ps-des", title: "恶魔之魂 重制版", sub: "Demon's Souls", genre: "动作 · 魂系", status: "硬核榜首", date: "2020.11.12", price: "¥398", metric: "88.7", note: "柏雷塔尼亚的原点复刻，蓝点把光影重做了一遍。", tags: ["硬核", "动作", "单人"] },
      { id: "ps-gt7", title: "GT 赛车 7", sub: "Gran Turismo 7", genre: "竞速 · 拟真", status: "竞速榜首", date: "2022.03.04", price: "¥468", metric: "90.1", note: "赛道与天气实时演算，方向盘后的每一次修正都有代价。", tags: ["竞速", "拟真", "联机"] },
      { id: "ps-returnal", title: "死亡回归", sub: "Returnal", genre: "射击 · 肉鸽", status: "硬核推荐", date: "2021.04.30", price: "¥468", metric: "87.4", note: "每一次死亡都重排星球地形，弹幕节奏配合手柄震动。", tags: ["肉鸽", "射击", "硬核"] },
      { id: "ps-stellar", title: "剑星", sub: "Stellar Blade", genre: "动作 · 科幻", status: "新作推荐", date: "2024.04.26", price: "¥468", metric: "89.3", note: "高速连段与格挡判定，把末世美学做成战斗语言。", tags: ["动作", "科幻", "单人"] },
      { id: "ps-uncharted", title: "神秘海域 盗贼传奇合辑", sub: "Uncharted: Legacy of Thieves", genre: "冒险 · 剧情", status: "经典榜单", date: "2022.01.28", price: "¥398", metric: "92.0", note: "两部正传一次打包，攀爬与枪战的电影化范本。", tags: ["冒险", "剧情", "单人"] },
      { id: "ps-tekken8", title: "铁拳 8", sub: "Tekken 8", genre: "格斗 · 竞技", status: "格斗推荐", date: "2024.01.26", price: "¥538", metric: "89.6", note: "热力系统把进攻拉满，回合之间只够喘半口气。", tags: ["格斗", "联机", "竞技"] },
      { id: "ps-yakuza8", title: "如龙 8", sub: "Like a Dragon: Infinite Wealth", genre: "RPG · 剧情", status: "剧情佳作", date: "2024.01.26", price: "¥468", metric: "91.8", note: "横跨两座城市的中年冒险，连支线都能拍成连续剧。", tags: ["剧情", "RPG", "单人"] }
    ]
  }
};
