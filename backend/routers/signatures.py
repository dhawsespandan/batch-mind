import os
import sys
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'
))

from state import get_models, models

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

@router.get("/check-improvement")
def check_improvement():
    batch_data = models.get("batch_explanations")
    if not batch_data:
        return {"improvements": []}
    try:
        response = supabase.table("golden_signatures").select("*").execute()
        signatures = response.data or []
    except:
        return {"improvements": []}

    def score(d, f, e):
        return (d / 100) * 0.4 + (1 - min(f, 2) / 2) * 0.3 + (1 - min(e, 120) / 120) * 0.3

    improvements = []
    for sig in signatures:
        sig_id = sig["signature_id"]
        current_score = score(
            sig.get("dissolution_rate", 0),
            sig.get("friability", 2),
            sig.get("total_energy_kwh", 120)
        )
        best_batch = None
        best_score = current_score
        for batch_id, batch in batch_data.items():
            outcomes = batch.get("predicted_outcomes", {})
            d = outcomes.get("dissolution_rate", 0)
            f = outcomes.get("friability", 2)
            e = 90
            if d < 85 or f > 1.0:
                continue
            s = score(d, f, e)
            if s > best_score:
                best_score = s
                best_batch = {
                    "batch_id": batch_id,
                    "dissolution_rate": d,
                    "friability": f,
                    "hardness": outcomes.get("hardness", 0),
                    "score": round(s, 4),
                }
        if best_batch:
            improvements.append({
                "signature_id": sig_id,
                "current_score": round(current_score, 4),
                "best_batch": best_batch,
                "improvement_pct": round((best_score - current_score) / current_score * 100, 1),
            })
    return {"improvements": improvements}

@router.get("/approvals/history")
def get_approval_history():
    result = supabase.table('approvals').select('*').order(
        'created_at', desc=True
    ).limit(20).execute()
    return {'approvals': result.data}

@router.get("/query/{objective}")
def query_signature(objective: str):
    m = get_models()
    sigs = m['golden_signatures']
    match = next(
        (s for s in sigs if objective.lower() in s['signature_id'].lower()),
        sigs[0] if sigs else None
    )
    return match or {"error": "No matching signature"}

@router.get("/{signature_id}")
def get_signature(signature_id: str):
    result = supabase.table('golden_signatures').select('*').eq(
        'signature_id', signature_id
    ).execute()
    if not result.data:
        return {"error": "Signature not found"}
    return result.data[0]

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

@router.post("/update/{signature_id}")
def update_signature(signature_id: str, payload: dict):
    try:
        update_data = {
            "dissolution_rate": payload.get("dissolution_rate"),
            "friability": payload.get("friability"),
            "hardness": payload.get("hardness"),
            "source_batch_id": payload.get("batch_id"),
            "human_approved": False,
        }
        supabase.table("golden_signatures").update(update_data).eq("signature_id", signature_id).execute()
        supabase.table("audit_log").insert({
            "action": "signature_updated",
            "entity_type": "golden_signature",
            "entity_id": signature_id,
            "details": f"Auto-updated from batch {payload.get('batch_id')} via continuous learning",
            "operator_id": payload.get("operator_id", "system"),
        }).execute()
        return {"success": True, "message": f"{signature_id} updated from batch {payload.get('batch_id')}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))