# backend/main.py
import json
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

from configs import MODEL_API_URL, MODEL_API_KEY, MODEL_NAME
from prompts import get_agent_prompt, get_metadata

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def call_stream_api(prompt: str):
    headers = {"Authorization": f"Bearer {MODEL_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": MODEL_NAME, 
        "messages": [{"role": "user", "content": prompt}], 
        "temperature": 0.8,
        "stream": True,
        "max_tokens": 1024,
    }
    
    try:
        response = requests.post(MODEL_API_URL, headers=headers, json=payload, timeout=30, stream=True)
        if response.status_code != 200:
            yield f"[API Error {response.status_code}]: {response.text}"
            return

        for line in response.iter_lines():
            if not line: continue
            line_str = line.decode('utf-8')
            if line_str.startswith('data: '):
                json_str = line_str[len('data: '):].strip()
                if json_str == '[DONE]': break
                try:
                    data = json.loads(json_str)
                    choices = data.get('choices')
                    if not isinstance(choices, list) or len(choices) == 0: continue
                    content = choices[0].get('delta', {}).get('content', '')
                    if content: yield content
                except Exception: continue

    except Exception as e:
        yield f"[Backend Error: {str(e)}]"


@app.get("/meta")
def get_system_metadata():
    return get_metadata()

class ChatRequest(BaseModel):
    scenarioId: str
    nextAgentId: str
    # 前端告诉后端，目前场景里有哪些人
    participants: list[str] 
    history: list

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    history_text = "\n".join([f"{msg['agentId']}: {msg['content']}" for msg in request.history])
    full_prompt = get_agent_prompt(
        request.scenarioId, 
        request.nextAgentId, 
        request.participants, 
        history_text
    )
    print(f"--- Scene: {request.scenarioId} | Turn: {request.nextAgentId} | Participants: {request.participants} ---")
    return StreamingResponse(
        call_stream_api(full_prompt), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
