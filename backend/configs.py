import os

# MODEL_API_URL = "http://10.191.84.38:8001/v1/chat/completions"
# MODEL_API_KEY = "0ac39b39674d98074828448d4c798ce4"
# MODEL_NAME = "DeepSeek-V3.1"

MODEL_API_URL = "https://openai-proxy.miracleplus.com/v1/chat/completions"
MODEL_API_KEY = "sk-ByqzGWjg3puXilvNbxmWsruk1eYDiMIV9rspVlfunucfkLpm"
MODEL_NAME = "google/gemini-3-flash-preview"


# --- 1. 场景池 (Scenarios) ---
# 仅包含环境描述、开场白、背景设定
SCENARIOS = {
    "rainy_manchester": {
        "name": "曼彻斯特雨夜",
        "description": "2024年的曼彻斯特，大雨倾盆。一家复古的爵士乐酒吧角落。窗外是积水的街道和匆忙的行人，屋内有着暖黄的灯光和低沉的萨克斯风。",
        "opening_line": "雨点敲打着窗玻璃，酒吧的门被推开，冷风伴着湿气钻了进来。"
    },
    "cyber_bunker": {
        "name": "赛博地下掩体",
        "description": "2077年，新东京第9区地下深处。这里是反抗军的临时据点，周围堆满了改造义肢和全息投影设备。空气中弥漫着机油和臭氧的味道。",
        "opening_line": "警报声刚刚停止，全息地图闪烁着红色的警告灯。"
    },
    "mars_colony": {
        "name": "火星殖民地温室",
        "description": "火星基地Alpha-1的植物温室。巨大的玻璃穹顶外是红色的荒原和璀璨的星空，内部则是郁郁葱葱的转基因植物。维生系统的嗡嗡声是唯一的背景音。",
        "opening_line": "氧气循环系统发出一声轻微的叹息，这是火星上最宁静的时刻。"
    },
    "talk_show": {
        "name": "深夜脱口秀现场",
        "description": "演播厅灯光聚焦，台下坐满了观众（虽然现在很安静）。两把舒适的扶手椅，中间放着一杯水。这是一场关于人类命运的终极辩论。",
        "opening_line": "导播倒数三、二、一，On Air 指示灯亮起。"
    }
}

# --- 2. 角色池 (Agents) ---
AGENTS = {
    "mark": {
        "name": "Mark",
        "role": "愤世嫉俗的记者",
        "personality": "在任何情况下都喜欢讽刺，悲观主义，不管在酒吧还是火星，都觉得世界要完蛋了。",
        "style": "purple"
    },
    "elias": {
        "name": "Elias",
        "role": "理想主义诗人",
        "personality": "无论环境多恶劣，总能发现美。喜欢引用隐喻，说话像写诗，非常感性。",
        "style": "amber"
    },
    "sarah": {
        "name": "Sarah",
        "role": "硬核生存专家",
        "personality": "冷静、理智、实用主义。看到什么都先分析能不能吃、安不安全、怎么利用。不喜欢废话。",
        "style": "blue"
    },
    "professor": {
        "name": "Professor X",
        "role": "量子物理学家",
        "personality": "有点疯癫，此时此刻总觉得这一切都是模拟程序。喜欢用复杂的科学术语解释日常现象。",
        "style": "default"
    },
    "trump_bot": {
        "name": "Donny",
        "role": "前任总统",
        "personality": "自信爆棚，觉得这里的一切都是他建造的，或者都需要他来拯救。喜欢用简单的形容词（Huge, Disaster）。",
        "style": "amber"
    }
}