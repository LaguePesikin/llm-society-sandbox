from configs import SCENARIOS, AGENTS

def get_metadata():
    """返回给前端用于选择的数据"""
    return {
        "scenarios": SCENARIOS,
        "agents": AGENTS
    }

def get_agent_prompt(scenario_id: str, current_agent_id: str, other_agent_ids: list, history_text: str):
    # 1. 获取基础信息
    scenario = SCENARIOS.get(scenario_id)
    agent = AGENTS.get(current_agent_id)
    
    if not scenario or not agent:
        return "System Config Error: Missing Scenario or Agent"

    # 2. 构建“在场其他人”的描述
    others_desc = []
    for oid in other_agent_ids:
        if oid == current_agent_id: continue
        other = AGENTS.get(oid)
        if other:
            others_desc.append(f"- {other['name']} ({other['role']}): {other['personality']}")
    
    others_text = "\n".join(others_desc) if others_desc else "Only you are here."

    # 3. 组装 Prompt
    prompt = f"""
You are roleplaying in a simulation.
---
**ENVIRONMENT (Where you are):**
Scenario: {scenario['name']}
Description: {scenario['description']}

**YOUR CHARACTER:**
Name: {agent['name']}
Role: {agent['role']}
Personality: {agent['personality']}

**OTHER CHARACTERS PRESENT:**
{others_text}

**CONVERSATION HISTORY:**
{history_text}

---
**INSTRUCTION:**
Based on the history, continue the conversation as {agent['name']}.
1. Stay strictly in character. Reflect your personality in your tone and word choice.
2. React to the environment ({scenario['name']}) and what others said.
3. Keep your response concise (under 50 words).
4. Output Format: Just the spoken text (no "Mark says:" prefixes).
"""
    return prompt.strip()