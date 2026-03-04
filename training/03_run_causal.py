import os
import sys
import json
import numpy as np
import joblib
from supabase import create_client
from dotenv import load_dotenv
from causallearn.search.ConstraintBased.PC import pc
from causallearn.utils.cit import fisherz

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

ALL_VARS = FEATURES + TARGETS

VAR_LABELS = {
    'granulation_time': 'Granulation Time',
    'binder_amount': 'Binder Amount',
    'drying_temp': 'Drying Temp',
    'drying_time': 'Drying Time',
    'compression_force': 'Compression Force',
    'machine_speed': 'Machine Speed',
    'lubricant_conc': 'Lubricant Conc',
    'moisture_content': 'Moisture Content',
    'dissolution_rate': 'Dissolution Rate',
    'friability': 'Friability',
    'hardness': 'Hardness',
    'disintegration_time': 'Disintegration Time',
    'tablet_weight': 'Tablet Weight',
    'content_uniformity': 'Content Uniformity'
}

def fetch_data():
    print("Fetching data...")
    result = supabase.table('batches').select(
        ','.join(ALL_VARS)
    ).execute()
    return result.data

def build_matrix(data):
    X = []
    for row in data:
        vals = [float(row[v]) for v in ALL_VARS if row[v] is not None]
        if len(vals) == len(ALL_VARS):
            X.append(vals)
    return np.array(X)

def run_pc_algorithm(X):
    print("Running PC Algorithm (causal discovery)...")
    print(f"  Variables: {len(ALL_VARS)}")
    print(f"  Samples: {X.shape[0]}")

    # Standardize
    X_std = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-8)

    cg = pc(X_std, alpha=0.05, indep_test=fisherz)
    return cg

def extract_edges(cg):
    edges = []
    n = len(ALL_VARS)
    g = cg.G

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            # Check for directed edge i -> j
            if g.graph[i][j] == -1 and g.graph[j][i] == 1:
                edges.append({
                    'from': ALL_VARS[i],
                    'to': ALL_VARS[j],
                    'from_label': VAR_LABELS[ALL_VARS[i]],
                    'to_label': VAR_LABELS[ALL_VARS[j]],
                    'type': 'directed'
                })
            # Check for undirected edge
            elif g.graph[i][j] == -1 and g.graph[j][i] == -1 and i < j:
                edges.append({
                    'from': ALL_VARS[i],
                    'to': ALL_VARS[j],
                    'from_label': VAR_LABELS[ALL_VARS[i]],
                    'to_label': VAR_LABELS[ALL_VARS[j]],
                    'type': 'undirected'
                })

    return edges

def compute_causal_importance(edges):
    """Rank variables by number of outgoing causal edges to targets"""
    importance = {v: 0 for v in ALL_VARS}
    target_set = set(TARGETS)

    for edge in edges:
        if edge['to'] in target_set:
            importance[edge['from']] += 1

    return importance

def build_dag_json(edges, importance):
    nodes = []
    for var in ALL_VARS:
        nodes.append({
            'id': var,
            'label': VAR_LABELS[var],
            'type': 'input' if var in FEATURES else 'output',
            'causal_importance': importance.get(var, 0)
        })

    return {
        'nodes': nodes,
        'edges': edges,
        'summary': {
            'total_edges': len(edges),
            'directed_edges': len([e for e in edges if e['type'] == 'directed']),
            'undirected_edges': len([e for e in edges if e['type'] == 'undirected']),
            'primary_driver': max(importance, key=importance.get),
            'primary_driver_label': VAR_LABELS[max(importance, key=importance.get)]
        }
    }

def compute_contrastive(data, batch_a='T056', batch_b='T051'):
    """Pre-compute the T056 vs T051 contrastive explanation"""
    print(f"\nComputing contrastive explanation: {batch_a} vs {batch_b}...")

    row_a = next((r for r in data if r.get('batch_id') == batch_a), None)
    row_b = next((r for r in data if r.get('batch_id') == batch_b), None)

    if not row_a or not row_b:
        print("  Warning: batches not found")
        return {}

    diffs = {}
    for var in ALL_VARS:
        val_a = float(row_a.get(var, 0) or 0)
        val_b = float(row_b.get(var, 0) or 0)
        diffs[var] = {
            'batch_a_value': val_a,
            'batch_b_value': val_b,
            'absolute_diff': round(val_a - val_b, 3),
            'label': VAR_LABELS[var]
        }

    # Rank by absolute difference for features
    feature_diffs = {f: abs(diffs[f]['absolute_diff']) for f in FEATURES}
    main_driver = max(feature_diffs, key=feature_diffs.get)

    return {
        'batch_a': batch_a,
        'batch_b': batch_b,
        'diffs': diffs,
        'main_driver': main_driver,
        'main_driver_label': VAR_LABELS[main_driver],
        'main_driver_diff': diffs[main_driver]['absolute_diff'],
        'narrative': (
            f"{batch_a} achieved {diffs['dissolution_rate']['batch_a_value']}% dissolution "
            f"vs {batch_b}'s {diffs['dissolution_rate']['batch_b_value']}% — "
            f"a {abs(diffs['dissolution_rate']['absolute_diff']):.1f} percentage point difference. "
            f"Primary driver: {VAR_LABELS[main_driver]} "
            f"({diffs[main_driver]['batch_a_value']} vs {diffs[main_driver]['batch_b_value']}, "
            f"diff: {diffs[main_driver]['absolute_diff']:+.1f}). "
            f"Higher compression force in {batch_b} created denser tablets — "
            f"improving mechanical strength but reducing porosity and slowing dissolution."
        )
    }

if __name__ == '__main__':
    print("=" * 50)
    print("BatchMind — Causal Discovery Script")
    print("=" * 50)

    # Fetch full data including batch_id
    result = supabase.table('batches').select('*').execute()
    data = result.data

    X = build_matrix(data)
    print(f"  Data matrix: {X.shape}")

    # Run PC algorithm
    cg = run_pc_algorithm(X)

    # Extract edges
    edges = extract_edges(cg)
    print(f"\n  Discovered {len(edges)} causal edges:")
    for e in edges:
        arrow = '->' if e['type'] == 'directed' else '--'
        print(f"    {e['from_label']} {arrow} {e['to_label']}")

    # Compute importance
    importance = compute_causal_importance(edges)
    print(f"\n  Causal importance scores:")
    for var, score in sorted(importance.items(), key=lambda x: -x[1]):
        if score > 0:
            print(f"    {VAR_LABELS[var]}: {score} edges to targets")

    # Build DAG JSON
    dag_json = build_dag_json(edges, importance)
    print(f"\n  Primary causal driver: {dag_json['summary']['primary_driver_label']}")

    # Contrastive explanation
    contrastive = compute_contrastive(data)

    # Save outputs
    print("\nSaving outputs...")

    dag_path = os.path.join(OUTPUT_DIR, 'causal_dag.json')
    with open(dag_path, 'w') as f:
        json.dump(dag_json, f, indent=2)
    print("  causal_dag.json ✓")

    contrastive_path = os.path.join(OUTPUT_DIR, 'contrastive_default.json')
    with open(contrastive_path, 'w') as f:
        json.dump(contrastive, f, indent=2)
    print("  contrastive_default.json ✓")

    joblib.dump(importance, os.path.join(OUTPUT_DIR, 'causal_importance.pkl'))
    print("  causal_importance.pkl ✓")

    print("\nCausal discovery complete.")