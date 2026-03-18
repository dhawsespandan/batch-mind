import os
import json
import joblib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

ML_DIR = os.path.join(os.path.dirname(__file__), 'ml')

def load_json(filename):
    with open(os.path.join(ML_DIR, filename)) as f:
        return json.load(f)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from state import models
    print("Loading ML artifacts...")
    models['gpr'] = joblib.load(os.path.join(ML_DIR, 'gpr_models.pkl'))
    models['scaler_X'] = joblib.load(os.path.join(ML_DIR, 'scaler_X.pkl'))
    models['pca'] = joblib.load(os.path.join(ML_DIR, 'pca.pkl'))
    models['conformal'] = joblib.load(os.path.join(ML_DIR, 'conformal.pkl'))
    models['training_data'] = joblib.load(os.path.join(ML_DIR, 'training_data.pkl'))
    models['signatures_lookup'] = joblib.load(os.path.join(ML_DIR, 'signatures_lookup.pkl'))
    models['causal_importance'] = joblib.load(os.path.join(ML_DIR, 'causal_importance.pkl'))
    models['shap_importance'] = joblib.load(os.path.join(ML_DIR, 'shap_importance.pkl'))
    models['energy_attribution'] = joblib.load(os.path.join(ML_DIR, 'energy_attribution.pkl'))
    models['metadata'] = joblib.load(os.path.join(ML_DIR, 'metadata.pkl'))
    models['causal_dag'] = load_json('causal_dag.json')
    models['contrastive_default'] = load_json('contrastive_default.json')
    models['phase_stats'] = load_json('phase_stats.json')
    models['fingerprints'] = load_json('fingerprints.json')
    models['global_importance'] = load_json('global_importance.json')
    models['batch_explanations'] = load_json('batch_explanations.json')
    models['prediction_intervals'] = load_json('prediction_intervals.json')
    models['coverage_stats'] = load_json('coverage_stats.json')
    models['feasibility_envelope'] = load_json('feasibility_envelope.json')
    models['golden_signatures'] = load_json('golden_signatures.json')
    models['compliance_results'] = load_json('compliance_results.json')
    print(f"  Loaded {len(models)} artifacts ✓")
    yield
    models.clear()

app = FastAPI(
    title="BatchMind API",
    description="Causal-First AI Copilot for Pharmaceutical Batch Manufacturing",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://batch-mind.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import predict, optimize, copilot, signatures, dashboard

app.include_router(predict.router, prefix="/predict", tags=["Predict"])
app.include_router(optimize.router, prefix="/optimize", tags=["Optimize"])
app.include_router(copilot.router, prefix="/copilot", tags=["Copilot"])
app.include_router(signatures.router, prefix="/signatures", tags=["Signatures"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

@app.get("/health")
def health():
    from state import models
    return {
        "status": "ok",
        "models_loaded": len(models),
        "version": "1.0.0"
    }

@app.get("/")
def root():
    return {"message": "BatchMind API is running"}