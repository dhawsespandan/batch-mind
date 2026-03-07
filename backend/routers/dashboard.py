import os
import sys
import numpy as np
from fastapi import APIRouter
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'
))

from state import get_models

router = APIRouter()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

# India grid carbon intensity (kg CO₂e per kWh) — CEA 2023
CARBON_INTENSITY = 0.82

@router.get("/overview")
def get_overview():
    m = get_models()
    coverage = m['coverage_stats']
    envelope = m['feasibility_envelope']
    phase_stats = m['phase_stats']

    avg_accuracy = np.mean([
        coverage[t]['accuracy'] for t in coverage
    ])

    total_mean_energy = sum(
        phase_stats[p]['mean_kwh']
        for p in phase_stats
    )

    compression_energy_pct = round(
        phase_stats.get('Compression', {}).get('mean_kwh', 50) /
        total_mean_energy * 100, 1
    ) if total_mean_energy > 0 else 53.8

    mean_co2e = round(total_mean_energy * CARBON_INTENSITY, 2)
    min_co2e = round(72.71 * CARBON_INTENSITY, 2)
    max_co2e = round(117.14 * CARBON_INTENSITY, 2)
    co2e_saving = round((117.14 - 72.71) * CARBON_INTENSITY, 2)
    co2e_saving_pct = round((117.14 - 72.71) / 117.14 * 100, 1)

    return {
        'model_accuracy': round(float(avg_accuracy), 2),
        'total_batches': 60,
        'feasible_batches': envelope['feasible_batch_count'],
        'feasibility_pct': round(
            envelope['feasible_batch_count'] / 60 * 100, 1
        ),
        'feasibility_window': f"{envelope['compression_force_min']}–"
                              f"{envelope['compression_force_max']} kN",
        'golden_signatures': 3,
        'primary_driver': 'Compression Force',
        'compression_energy_pct': compression_energy_pct,
        'min_energy_kwh': 72.71,
        'max_energy_kwh': 117.14,
        'mean_energy_kwh': round(total_mean_energy, 2),
        'energy_saving_potential_pct': co2e_saving_pct,
        # CO₂e fields
        'carbon_intensity': CARBON_INTENSITY,
        'mean_co2e_kg': mean_co2e,
        'min_co2e_kg': min_co2e,
        'max_co2e_kg': max_co2e,
        'co2e_saving_kg': co2e_saving,
        'co2e_saving_pct': co2e_saving_pct,
    }

@router.get("/phase-energy")
def get_phase_energy():
    m = get_models()
    phase_stats = m['phase_stats']

    phases = []
    for phase_name, stats in phase_stats.items():
        mean_kwh = stats['mean_kwh']
        phases.append({
            'phase': phase_name,
            'mean_kwh': mean_kwh,
            'std_kwh': stats['std_kwh'],
            'min_kwh': stats['min_kwh'],
            'max_kwh': stats['max_kwh'],
            'pct_of_total': stats.get('pct_of_total', 0),
            'mean_co2e_kg': round(mean_kwh * CARBON_INTENSITY, 2),
        })

    return {'phases': phases, 'carbon_intensity': CARBON_INTENSITY}

@router.get("/batch-scatter")
def get_batch_scatter():
    m = get_models()
    intervals = m['prediction_intervals']
    training_data = m['training_data']
    batch_ids = training_data['batch_ids']
    X = training_data['X']
    FEATURE_LIST = m['metadata']['features']
    cf_idx = FEATURE_LIST.index('compression_force')
    envelope = m['feasibility_envelope']
    energy_attr = m['energy_attribution']

    batches = []
    for i, batch_id in enumerate(batch_ids):
        cf = float(X[i, cf_idx])
        preds = intervals.get(batch_id, {})
        energy = energy_attr.get(batch_id, {}).get('total_kwh', 0)
        in_zone = (
            envelope['compression_force_min'] <= cf <=
            envelope['compression_force_max']
        )
        batches.append({
            'batch_id': batch_id,
            'compression_force': round(cf, 2),
            'dissolution_rate': preds.get('dissolution_rate', {}).get('predicted', 0),
            'friability': preds.get('friability', {}).get('predicted', 0),
            'hardness': preds.get('hardness', {}).get('predicted', 0),
            'total_energy_kwh': round(float(energy), 2),
            'co2e_kg': round(float(energy) * CARBON_INTENSITY, 2),
            'in_feasible_zone': in_zone
        })

    return {'batches': batches, 'envelope': envelope}

@router.get("/causal-dag")
def get_causal_dag():
    m = get_models()
    return m['causal_dag']

@router.get("/model-stats")
def get_model_stats():
    m = get_models()
    coverage = m['coverage_stats']

    stats = []
    for target, data in coverage.items():
        stats.append({
            'target': target,
            'accuracy': data['accuracy'],
            'mape': data['mape'],
            'coverage_90': data['coverage_90'],
            'coverage_95': data['coverage_95']
        })

    return {
        'models': stats,
        'avg_accuracy': round(
            float(np.mean([s['accuracy'] for s in stats])), 2
        ),
        'avg_coverage_95': round(
            float(np.mean([s['coverage_95'] for s in stats])), 2
        )
    }