import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: Optional[dict] = {}

RULES = [
    {
        "keywords": ["dissolution", "dissolv"],
        "response": """**Dissolution Rate Analysis**

Based on GPR model predictions across 60 batches:

- **Feasible range:** 85–99.9% (spec: ≥85%)
- **Key driver:** Compression Force — lower CF → higher dissolution
- **Critical insight:** T056 achieved 99.85% dissolution but failed friability (1.895%) — the trade-off is structural

**Recommendation:** Target CF 8.0–10.0 kN for dissolution-optimized batches. GS_DISSOLUTION signature (T023, CF=8.2 kN) achieves 94.9% with full compliance."""
    },
    {
        "keywords": ["friability", "friable"],
        "response": """**Friability Analysis**

Friability measures tablet mechanical strength (spec: ≤1.0%):

- **Safe zone:** CF > 8.0 kN keeps friability below 1.0%
- **Risk zone:** CF > 14.0 kN → friability exceeds spec
- **Causal finding:** PC Algorithm confirms Compression Force → Friability as direct causal edge

**Key trade-off:** Higher compression = lower friability BUT lower dissolution. The 8.0–14.0 kN feasibility window is the only region satisfying both constraints simultaneously."""
    },
    {
        "keywords": ["energy", "kwh", "power", "consumption"],
        "response": """**Energy Attribution Analysis (PELT)**

Phase-level energy breakdown (mean across 60 batches):

- **Compression:** 53.8% of total energy (dominant driver)
- **Drying:** 12.9%
- **Milling:** 9.3%
- **Coating:** 10.6%

**CO₂e impact:** At 0.82 kg CO₂e/kWh (India CEA 2023):
- Min batch: 59.6 kg CO₂e (GS_ENERGY, T038)
- Max batch: 96.1 kg CO₂e
- **Saving potential: 36.5 kg CO₂e per batch**

PELT detected 7 change points on T014 and T038 — indicating possible equipment degradation events."""
    },
    {
        "keywords": ["compression", "force", "cf", "kn"],
        "response": """**Compression Force — Primary Process Driver**

Causal discovery (PC Algorithm, 13 edges) identifies Compression Force as the root driver:

- **Feasibility window:** 8.0–14.0 kN
- **Below 8.0 kN:** Friability > 1.0% (tablet too soft)
- **Above 14.0 kN:** Dissolution < 85% (tablet too hard to dissolve)
- **Energy:** Compression = 53.8% of total batch energy

**Optimal operating point:** 8.2 kN (GS_BALANCED/GS_DISSOLUTION) for quality, 11.0 kN (GS_ENERGY) for energy efficiency."""
    },
    {
        "keywords": ["golden", "signature", "gs_", "blueprint"],
        "response": """**Golden Signatures**

Three optimal parameter sets extracted from feasibility analysis:

| Signature | CF | Dissolution | Friability | Energy |
|---|---|---|---|---|
| GS_BALANCED | 8.2 kN | 94.9% | 0.92% | 80.0 kWh |
| GS_DISSOLUTION | 8.2 kN | 94.9% | 0.92% | 80.0 kWh |
| GS_ENERGY | 11.0 kN | 91.8% | 0.81% | 72.7 kWh |

All signatures are within the 8.0–14.0 kN feasibility envelope. GS_ENERGY saves **7.3 kWh (6.0 kg CO₂e)** per batch vs GS_BALANCED."""
    },
    {
        "keywords": ["feasib", "envelope", "window", "compliant"],
        "response": """**Feasibility Envelope**

**Core finding:** Zero batches in this dataset satisfy ALL regulatory constraints simultaneously outside the 8.0–14.0 kN window.

- 42/60 batches (70%) are feasible
- 18/60 batches fail at least one quality spec
- Primary failure mode: dissolution < 85% OR friability > 1.0%

The Dissolution–Friability trade-off is **structurally embedded** in Compression Force — it cannot be resolved by tuning other parameters."""
    },
    {
        "keywords": ["t056", "t051", "contrastive", "differ", "why", "compare"],
        "response": """**Contrastive Batch Explanation: T056 vs T051**

These two batches represent opposite extremes:

| Metric | T056 | T051 |
|---|---|---|
| Dissolution | 99.85% ✓ | 82.15% ✗ |
| Friability | 1.895% ✗ | 0.302% ✓ |
| Hardness | 40.9N ✗ | 133.7N ✓ |

**Root cause:** Compression Force difference of ~13.5 kN
- T056: Very low CF → soft tablets → high dissolution, high friability
- T051: Very high CF → hard tablets → low dissolution, low friability

**Neither batch is compliant.** Both are outside the 8.0–14.0 kN feasibility window."""
    },
    {
        "keywords": ["accuracy", "model", "gpr", "prediction", "performance"],
        "response": """**GPR Model Performance**

Gaussian Process Regression trained on 60 batches, Leave-One-Out validation:

| Target | Accuracy |
|---|---|
| Dissolution Rate | 99.46% |
| Friability | 96.81% |
| Hardness | 97.92% |
| Disintegration Time | 97.00% |
| Tablet Weight | 99.67% |
| Content Uniformity | 99.60% |

**Average: 98.41%** (target was >90%)

Conformal prediction provides calibrated uncertainty intervals with 95.3% empirical coverage."""
    },
    {
        "keywords": ["optimize", "optimiz", "best", "recommend", "parameter", "setting"],
        "response": """**Parameter Optimization (NSGA-II)**

Multi-objective optimization via NSGA-II Pareto front:

**Recommended settings (GS_BALANCED):**
- Compression Force: 8.2 kN
- Granulation Time: 20 min
- Drying Temp: 54°C
- Machine Speed: 205 RPM

**Expected outcomes:**
- Dissolution: 94.9% ✓
- Friability: 0.92% ✓
- Energy: 80.0 kWh
- CO₂e: 65.6 kg

For energy-minimized production, use GS_ENERGY (CF=11.0 kN, 72.7 kWh, 59.6 kg CO₂e)."""
    },
    {
        "keywords": ["carbon", "co2", "emission", "sustainability", "environment"],
        "response": """**Carbon Emission Analysis**

BatchMind tracks CO₂e using India CEA 2023 grid intensity (0.82 kg CO₂e/kWh):

- **Average batch emissions:** ~76.5 kg CO₂e
- **Minimum (GS_ENERGY):** 59.6 kg CO₂e
- **Maximum:** 96.1 kg CO₂e
- **Saving potential:** 36.5 kg CO₂e per batch (38%)

**At scale (1000 batches/year):** Switching to GS_ENERGY saves ~36.5 tonnes CO₂e annually — equivalent to taking ~8 cars off the road."""
    },
    {
        "keywords": ["causal", "cause", "dag", "pc algorithm", "graph"],
        "response": """**Causal Discovery (PC Algorithm)**

PC Algorithm identified 13 causal edges in the manufacturing process DAG:

**Key causal paths:**
- Compression Force → Hardness (direct, strong)
- Compression Force → Dissolution Rate (direct, inverse)
- Compression Force → Friability (direct, inverse)
- Drying Temp → Moisture Content → Tablet Weight

**Why this matters:** Correlation-based ML would suggest many features matter equally. Causal discovery reveals Compression Force as the true root driver — other parameters have indirect or no causal effect on quality outcomes."""
    },
]

FALLBACK = """**BatchMind Decision Support**

I can help you with:
- **Dissolution & Friability** analysis and trade-offs
- **Compression Force** feasibility window (8.0–14.0 kN)
- **Energy attribution** by phase (PELT analysis)
- **Golden Signatures** — optimal parameter sets
- **Model performance** — GPR accuracy metrics
- **Carbon emissions** — CO₂e per batch
- **Causal discovery** — PC Algorithm findings
- **Batch comparison** — T056 vs T051 contrastive explanation

Try asking: *"Why did T056 fail?"* or *"What parameters should I use to minimize energy?"*"""


def match_rule(message: str) -> str:
    msg_lower = message.lower()
    for rule in RULES:
        if any(kw in msg_lower for kw in rule["keywords"]):
            return rule["response"]
    return FALLBACK


@router.post("/chat")
def chat(req: ChatRequest):
    response = match_rule(req.message)
    return {
        "response": response,
        "source": "rule_based",
        "model": "BatchMind Knowledge Engine v1.0"
    }


@router.get("/suggestions")
def get_suggestions():
    return {
        "suggestions": [
            "What parameters should I use to maximize dissolution rate?",
            "Why did T056 and T051 behave so differently?",
            "Which phase consumes the most energy?",
            "What is the feasibility window for compression force?",
            "How much CO₂e can we save per batch?",
            "What does the causal DAG show?",
        ]
    }