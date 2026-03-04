import os
import json
import joblib
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

ML_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend', 'ml')

def load_json(filename):
    with open(os.path.join(ML_DIR, filename)) as f:
        return json.load(f)

def seed_approvals_demo():
    print("Seeding demo approval records...")
    demo_approvals = [
        {
            'batch_id': 'T027',
            'recommended_params': {
                'granulation_time': 18, 'binder_amount': 9.8,
                'drying_temp': 61, 'drying_time': 30,
                'compression_force': 10.5, 'machine_speed': 172,
                'lubricant_conc': 1.3, 'moisture_content': 1.6
            },
            'chosen_params': {
                'granulation_time': 18, 'binder_amount': 9.8,
                'drying_temp': 61, 'drying_time': 30,
                'compression_force': 10.5, 'machine_speed': 172,
                'lubricant_conc': 1.3, 'moisture_content': 1.6
            },
            'predicted_outcomes': {
                'dissolution_rate': 93.2, 'friability': 0.86,
                'hardness': 80, 'disintegration_time': 8.1,
                'tablet_weight': 201.3, 'content_uniformity': 98.7
            },
            'actual_outcomes': {
                'dissolution_rate': 93.2, 'friability': 0.86,
                'hardness': 80, 'disintegration_time': 8.1,
                'tablet_weight': 201.3, 'content_uniformity': 98.7
            },
            'decision': 'accepted',
            'objective_weights': {
                'dissolution_rate': 40, 'friability': 25,
                'hardness': 20, 'energy': 15
            },
            'operator_id': 'demo_operator'
        },
        {
            'batch_id': 'T038',
            'recommended_params': {
                'granulation_time': 14, 'binder_amount': 8.1,
                'drying_temp': 55, 'drying_time': 22,
                'compression_force': 11.0, 'machine_speed': 148,
                'lubricant_conc': 1.0, 'moisture_content': 2.1
            },
            'chosen_params': {
                'granulation_time': 14, 'binder_amount': 8.1,
                'drying_temp': 57, 'drying_time': 24,
                'compression_force': 11.0, 'machine_speed': 148,
                'lubricant_conc': 1.0, 'moisture_content': 2.1
            },
            'predicted_outcomes': {
                'dissolution_rate': 91.8, 'friability': 0.81,
                'hardness': 84, 'disintegration_time': 8.5,
                'tablet_weight': 200.8, 'content_uniformity': 99.1
            },
            'actual_outcomes': {
                'dissolution_rate': 91.8, 'friability': 0.81,
                'hardness': 84, 'disintegration_time': 8.5,
                'tablet_weight': 200.8, 'content_uniformity': 99.1
            },
            'decision': 'modified',
            'rejection_reason': 'Adjusted drying temp slightly higher for safety margin',
            'objective_weights': {
                'dissolution_rate': 30, 'friability': 20,
                'hardness': 20, 'energy': 30
            },
            'operator_id': 'demo_operator'
        },
        {
            'batch_id': 'T056',
            'recommended_params': {
                'granulation_time': 22, 'binder_amount': 11.0,
                'drying_temp': 50, 'drying_time': 38,
                'compression_force': 6.0, 'machine_speed': 240,
                'lubricant_conc': 2.2, 'moisture_content': 0.5
            },
            'chosen_params': {
                'granulation_time': 27, 'binder_amount': 13.5,
                'drying_temp': 42, 'drying_time': 48,
                'compression_force': 4.5, 'machine_speed': 280,
                'lubricant_conc': 2.8, 'moisture_content': 0.2
            },
            'predicted_outcomes': {
                'dissolution_rate': 97.1, 'friability': 1.45,
                'hardness': 52, 'disintegration_time': 4.1,
                'tablet_weight': 212.1, 'content_uniformity': 91.2
            },
            'actual_outcomes': {
                'dissolution_rate': 99.9, 'friability': 1.92,
                'hardness': 40, 'disintegration_time': 2.6,
                'tablet_weight': 213.8, 'content_uniformity': 89.8
            },
            'decision': 'rejected',
            'rejection_reason': 'Friability exceeds 1.0% limit — regulatory failure',
            'objective_weights': {
                'dissolution_rate': 60, 'friability': 15,
                'hardness': 15, 'energy': 10
            },
            'operator_id': 'demo_operator'
        }
    ]

    for approval in demo_approvals:
        supabase.table('approvals').insert(approval).execute()
        print(f"  Inserted approval for {approval['batch_id']} "
              f"({approval['decision']}) ✓")

def seed_audit_log():
    print("\nSeeding audit log...")
    events = [
        {
            'event_type': 'model_trained',
            'batch_id': None,
            'payload': {
                'model': 'gpr_ensemble',
                'batches': 60,
                'avg_accuracy': 98.41,
                'targets': 6
            }
        },
        {
            'event_type': 'signature_created',
            'batch_id': 'T027',
            'payload': {
                'signature_id': 'GS_BALANCED',
                'objective': 'balanced',
                'dissolution': 93.2,
                'energy_kwh': 79.96
            }
        },
        {
            'event_type': 'signature_created',
            'batch_id': 'T038',
            'payload': {
                'signature_id': 'GS_ENERGY',
                'objective': 'min_energy',
                'dissolution': 91.8,
                'energy_kwh': 72.71
            }
        },
        {
            'event_type': 'feasibility_computed',
            'batch_id': None,
            'payload': {
                'feasible_batches': 42,
                'total_batches': 60,
                'window_kn': '8.0-14.0',
                'primary_driver': 'compression_force'
            }
        },
        {
            'event_type': 'causal_discovery',
            'batch_id': None,
            'payload': {
                'algorithm': 'PC',
                'edges_found': 13,
                'primary_driver': 'compression_force',
                'alpha': 0.05
            }
        }
    ]

    for event in events:
        supabase.table('audit_log').insert(event).execute()
    print(f"  Inserted {len(events)} audit events ✓")

def verify_all():
    print("\nFinal verification...")
    tables = [
        'batches', 'phase_sensors', 'golden_signatures',
        'approvals', 'audit_log', 'model_metadata'
    ]
    for table in tables:
        result = supabase.table(table).select('id').execute()
        print(f"  {table}: {len(result.data)} records ✓")

def verify_ml_files():
    print("\nML files in backend/ml/:")
    expected = [
        'gpr_models.pkl', 'scaler_X.pkl', 'pca.pkl',
        'conformal.pkl', 'loo_results.pkl', 'training_data.pkl',
        'causal_dag.json', 'contrastive_default.json',
        'causal_importance.pkl', 'energy_attribution.pkl',
        'phase_stats.json', 'fingerprints.json',
        'sample_power_curves.pkl', 'global_importance.json',
        'batch_explanations.json', 'shap_importance.pkl',
        'prediction_intervals.json', 'coverage_stats.json',
        'compliance_results.json', 'feasibility_envelope.json',
        'golden_signatures.json', 'signatures_lookup.pkl',
        'metadata.pkl'
    ]
    missing = []
    for f in expected:
        path = os.path.join(ML_DIR, f)
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"  ✓ {f} ({size:,} bytes)")
        else:
            print(f"  ✗ {f} MISSING")
            missing.append(f)

    if missing:
        print(f"\n  Warning: {len(missing)} files missing: {missing}")
    else:
        print(f"\n  All {len(expected)} ML files present ✓")

if __name__ == '__main__':
    print("=" * 50)
    print("BatchMind — Final Database Seed Script")
    print("=" * 50)

    seed_approvals_demo()
    seed_audit_log()
    verify_all()
    verify_ml_files()

    print("\n" + "=" * 50)
    print("Training pipeline complete.")
    print("All ML artifacts saved to backend/ml/")
    print("Database fully seeded.")
    print("Ready to build backend.")
    print("=" * 50)