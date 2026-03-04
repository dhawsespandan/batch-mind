import os
import sys
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'
))

# sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from state import get_models

router = APIRouter()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

class ApprovalRequest(BaseModel):
    batch_id: str
    recommended_params: dict
    chosen_params: dict
    predicted_outcomes: dict
    decision: str
    rejection_reason: Optional[str] = None
    objective_weights: Optional[dict] = None
    operator_id: Optional[str] = "demo_operator"

@router.get("/")
def get_all_signatures():
    result = supabase.table('golden_signatures').select('*').execute()
    return {'signatures': result.data, 'total': len(result.data)}

@router.get("/{signature_id}")
def get_signature(signature_id: str):
    result = supabase.table('golden_signatures').select('*').eq(
        'signature_id', signature_id
    ).execute()
    if not result.data:
        return {"error": "Signature not found"}
    return result.data[0]

@router.get("/query/{objective}")
def query_signature(objective: str):
    m = get_models()
    sigs = m['golden_signatures']
    match = next(
        (s for s in sigs if objective.lower() in s['signature_id'].lower()),
        sigs[0] if sigs else None
    )
    return match or {"error": "No matching signature"}

@router.post("/approval")
def submit_approval(req: ApprovalRequest):
    record = {
        'batch_id': req.batch_id,
        'recommended_params': req.recommended_params,
        'chosen_params': req.chosen_params,
        'predicted_outcomes': req.predicted_outcomes,
        'decision': req.decision,
        'rejection_reason': req.rejection_reason,
        'objective_weights': req.objective_weights,
        'operator_id': req.operator_id
    }
    supabase.table('approvals').insert(record).execute()
    supabase.table('audit_log').insert({
        'event_type': 'approval_submitted',
        'batch_id': req.batch_id,
        'payload': {'decision': req.decision, 'operator': req.operator_id}
    }).execute()
    return {"status": "recorded", "decision": req.decision}

@router.get("/approvals/history")
def get_approval_history():
    result = supabase.table('approvals').select('*').order(
        'created_at', desc=True
    ).limit(20).execute()
    return {'approvals': result.data}