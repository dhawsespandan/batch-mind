import os
import sys
import json
import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'
))

# sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from state import get_models

router = APIRouter()

SYSTEM_PROMPT = """You are BatchMind, an AI copilot for pharmaceutical batch manufacturing.
You have access to a Gaussian Process Regression model trained on 60 real batches (T001-T060).
Model accuracy: 98.41% average across 6 quality targets.

KEY FINDING from the data:
- Compression Force is the primary causal driver of the Dissolution-Friability trade-off
- Feasibility window: 8.0-14.0 kN compression force
- Zero batches in the dataset satisfy ALL regulatory constraints simultaneously
- Compression phase accounts for 53.8% of total batch energy

Regulatory limits (pharmaceutical):
- Dissolution Rate: minimum 85%
- Friability: maximum 1.0%
- Hardness: minimum 50N
- Disintegration Time: maximum 15 minutes
- Tablet Weight: 195-207 mg
- Content Uniformity: 85-115%

Golden Signatures available:
- GS_BALANCED (T027): Best balanced compliance. Dissolution 93.2%, Friability 0.86%, Energy 79.96 kWh
- GS_DISSOLUTION (T023): Max dissolution. Dissolution 94.9%, Friability 0.92%, Energy 79.96 kWh
- GS_ENERGY (T038): Min energy. Dissolution 91.8%, Friability 0.81%, Energy 72.71 kWh

When answering:
1. Be concise and specific — this is a manufacturing floor tool
2. Always mention confidence levels when giving predictions
3. Flag any regulatory compliance risks clearly
4. Reference specific batch IDs and Golden Signatures when relevant
5. For parameter recommendations, always check the 8.0-14.0 kN feasibility window
6. Format responses clearly with key numbers highlighted

Respond in plain text, no markdown formatting."""

class Message(BaseModel):
    role: str
    content: str

class CopilotRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    context: Optional[dict] = {}

def build_context_string(m):
    envelope = m['feasibility_envelope']
    coverage = m['coverage_stats']
    avg_acc = np.mean([coverage[t]['accuracy'] for t in coverage])

    return f"""
Current system context:
- Model average accuracy: {avg_acc:.1f}%
- Feasibility window: {envelope['compression_force_min']}-{envelope['compression_force_max']} kN
- Feasible batches: {envelope['feasible_batch_count']}/60
- Primary energy phase: Compression (53.8% of total)
- Min batch energy observed: 72.71 kWh (T038)
- Max batch energy observed: 117.14 kWh (T014)
"""

@router.post("/chat")
def chat(req: CopilotRequest):
    m = get_models()

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.3,
        max_output_tokens=800
    )

    context_str = build_context_string(m)
    system_content = SYSTEM_PROMPT + "\n" + context_str

    if req.context:
        system_content += f"\nAdditional context: {json.dumps(req.context)}"

    messages = [SystemMessage(content=system_content)]

    for h in req.history[-6:]:
        if h.role == "user":
            messages.append(HumanMessage(content=h.content))
        else:
            
            messages.append(AIMessage(content=h.content))

    messages.append(HumanMessage(content=req.message))

    response = llm.invoke(messages)
    reply = response.content

    return {
        'reply': reply,
        'model': 'gemini-1.5-flash',
        'context_used': bool(req.context)
    }

@router.get("/suggestions")
def get_suggestions():
    return {
        'suggestions': [
            "What parameters should I use to maximize dissolution rate?",
            "Why did T056 and T051 behave so differently?",
            "Which phase consumes the most energy?",
            "What is the feasibility window for compression force?",
            "Show me the golden signature for minimum energy",
            "What are the regulatory limits I need to meet?",
            "Why is compression force so important?",
            "Compare T027 and T038 performance"
        ]
    }