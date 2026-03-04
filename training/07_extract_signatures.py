import os
import json
import numpy as np
import joblib
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend', 'ml')

FEATURES = [
    'granulation_time', 'binder_amount', 'drying_temp', 'drying_time',
    'compression_force', 'machine_speed', 'lubricant_conc', 'moisture_content'
]

TARGETS = [
    'dissolution_rate', 'friability', 'hardness',
    'disintegration_time', 'tablet_weight', 'content_uniformity'
]

def fetch_feasible_batches():
    print("Fetching feasible batches...")
    result = supabase.table('batches').select('*').eq('is_feasible', True).execute()
    print(f"  Found {len(result.data)} feasible batches")
    return result.data

def fetch_all_batches():
    result = supabase.table('batches').select('*').execute()
    return result.data

def score_balanced(row):
    """Score for best all-round compliance"""
    diss = float(row.get('dissolution_rate') or 0)
    fria = float(row.get('friability') or 99)
    hard = float(row.get('hardness') or 0)
    dis_t = float(row.get('disintegration_time') or 99)
    energy = float(row.get('total_energy_kwh') or 999)

    # Normalize each to 0-1 scale based on dataset ranges
    diss_score = (diss - 81.2) / (99.9 - 81.2)
    fria_score = 1 - (fria - 0.29) / (1.92 - 0.29)
    hard_score = (hard - 40) / (135 - 40)
    dis_score = 1 - (dis_t - 2.6) / (17.5 - 2.6)
    energy_score = 1 - (energy - 63.5) / (126.1 - 63.5)

    return (diss_score * 0.3 + fria_score * 0.25 +
            hard_score * 0.2 + dis_score * 0.15 + energy_score * 0.1)

def score_dissolution(row):
    """Score for max dissolution within feasibility"""
    return float(row.get('dissolution_rate') or 0)

def score_energy(row):
    """Score for minimum energy within feasibility"""
    energy = float(row.get('total_energy_kwh') or 999)
    return -energy  # Negative because lower is better

def find_best_batch(batches, score_fn):
    scored = [(score_fn(b), b) for b in batches]
    scored.sort(key=lambda x: -x[0])
    return scored[0][1] if scored else None

def build_signature_record(batch, sig_id, objective, human_approved=False):
    # Build embedding vector from process parameters (for pgvector similarity search)
    embedding = [
        float(batch.get('granulation_time') or 0),
        float(batch.get('binder_amount') or 0),
        float(batch.get('drying_temp') or 0),
        float(batch.get('drying_time') or 0),
        float(batch.get('compression_force') or 0),
        float(batch.get('machine_speed') or 0),
        float(batch.get('lubricant_conc') or 0),
        float(batch.get('moisture_content') or 0),
    ]

    # Normalize embedding to unit vector
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = (np.array(embedding) / norm).tolist()

    return {
        'signature_id': sig_id,
        'source_batch_id': batch['batch_id'],
        'objective': objective,
        'granulation_time': batch.get('granulation_time'),
        'binder_amount': batch.get('binder_amount'),
        'drying_temp': batch.get('drying_temp'),
        'drying_time': batch.get('drying_time'),
        'compression_force': batch.get('compression_force'),
        'machine_speed': batch.get('machine_speed'),
        'lubricant_conc': batch.get('lubricant_conc'),
        'moisture_content': batch.get('moisture_content'),
        'dissolution_rate': batch.get('dissolution_rate'),
        'friability': batch.get('friability'),
        'hardness': batch.get('hardness'),
        'disintegration_time': batch.get('disintegration_time'),
        'content_uniformity': batch.get('content_uniformity'),
        'tablet_weight': batch.get('tablet_weight'),
        'total_energy_kwh': batch.get('total_energy_kwh'),
        'is_feasible': True,
        'confidence_score': 0.92,
        'version': 1,
        'human_approved': human_approved,
        'embedding': embedding
    }

def print_signature(sig):
    print(f"\n  [{sig['signature_id']}] Source: {sig['source_batch_id']}")
    print(f"    Objective: {sig['objective']}")
    print(f"    Compression Force: {sig['compression_force']} kN")
    print(f"    Dissolution: {sig['dissolution_rate']}% | "
          f"Friability: {sig['friability']}% | "
          f"Hardness: {sig['hardness']}N")
    print(f"    Disintegration: {sig['disintegration_time']} min | "
          f"Energy: {sig['total_energy_kwh']} kWh")

if __name__ == '__main__':
    print("=" * 50)
    print("BatchMind — Golden Signature Extraction")
    print("=" * 50)

    feasible = fetch_feasible_batches()
    all_batches = fetch_all_batches()

    print(f"\nExtracting 3 Golden Signatures from {len(feasible)} feasible batches...")

    # GS_BALANCED — best all-round
    best_balanced = find_best_batch(feasible, score_balanced)
    gs_balanced = build_signature_record(
        best_balanced, 'GS_BALANCED',
        'Best balanced compliance across all constraints',
        human_approved=True
    )

    # GS_DISSOLUTION — max dissolution
    best_dissolution = find_best_batch(feasible, score_dissolution)
    gs_dissolution = build_signature_record(
        best_dissolution, 'GS_DISSOLUTION',
        'Maximum dissolution rate within feasibility envelope',
        human_approved=True
    )

    # GS_ENERGY — min energy
    best_energy = find_best_batch(feasible, score_energy)
    gs_energy = build_signature_record(
        best_energy, 'GS_ENERGY',
        'Minimum energy consumption within feasibility envelope',
        human_approved=True
    )

    signatures = [gs_balanced, gs_dissolution, gs_energy]

    print("\nExtracted signatures:")
    for sig in signatures:
        print_signature(sig)

    # Insert into Supabase
    print("\nInserting into Supabase...")
    supabase.table('golden_signatures').delete().neq('id', 0).execute()

    for sig in signatures:
        supabase.table('golden_signatures').insert(sig).execute()
        print(f"  Inserted {sig['signature_id']} ✓")

    # Save locally
    with open(os.path.join(OUTPUT_DIR, 'golden_signatures.json'), 'w') as f:
        json.dump(signatures, f, indent=2)
    print("  golden_signatures.json ✓")

    # Also save a quick-lookup dict
    sig_lookup = {s['signature_id']: s for s in signatures}
    joblib.dump(sig_lookup, os.path.join(OUTPUT_DIR, 'signatures_lookup.pkl'))
    print("  signatures_lookup.pkl ✓")

    print("\nGolden Signature extraction complete.")