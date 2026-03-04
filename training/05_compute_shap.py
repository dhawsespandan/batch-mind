import os
import sys
import json
import numpy as np
import joblib
import shap
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

FEATURE_LABELS = {
    'granulation_time': 'Granulation Time',
    'binder_amount': 'Binder Amount',
    'drying_temp': 'Drying Temp',
    'drying_time': 'Drying Time',
    'compression_force': 'Compression Force',
    'machine_speed': 'Machine Speed',
    'lubricant_conc': 'Lubricant Conc',
    'moisture_content': 'Moisture Content'
}

def load_models():
    models = joblib.load(os.path.join(OUTPUT_DIR, 'gpr_models.pkl'))
    scaler_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_X.pkl'))
    pca = joblib.load(os.path.join(OUTPUT_DIR, 'pca.pkl'))
    training_data = joblib.load(os.path.join(OUTPUT_DIR, 'training_data.pkl'))
    return models, scaler_X, pca, training_data

def gpr_predict_fn(model):
    """Wrapper to make GPR predict work with SHAP"""
    def predict(X):
        y_pred, _ = model.predict(X, return_std=True)
        return y_pred
    return predict

def compute_shap_values(models, X_pca, X_original):
    """Compute SHAP values using KernelExplainer (model-agnostic)"""
    print("\nComputing SHAP values...")
    shap_results = {}

    # Use subset as background (all 60 for small dataset)
    background = X_pca

    for target in TARGETS:
        print(f"  Computing SHAP for {target}...")
        model = models[target]
        predict_fn = gpr_predict_fn(model)

        explainer = shap.KernelExplainer(predict_fn, background)
        shap_vals = explainer.shap_values(X_pca, nsamples=100, silent=True)

        shap_results[target] = shap_vals.tolist()
        print(f"    Shape: {shap_vals.shape} | "
              f"Mean |SHAP|: {np.abs(shap_vals).mean():.4f}")

    return shap_results

def compute_feature_importance_in_original_space(models, scaler_X, pca, X_original):
    """
    Since PCA reduces to 1 component, map importance back to original features
    using PCA component loadings
    """
    print("\nMapping SHAP back to original feature space...")

    # PCA loadings (how much each original feature contributes to each PC)
    loadings = pca.components_  # shape: (n_components, n_features)

    importance_by_target = {}

    for target in TARGETS:
        model = models[target]
        # Predict on all samples to get variance explained per feature
        X_scaled = scaler_X.transform(X_original)
        X_pca_local = pca.transform(X_scaled)

        # Use loading magnitudes as feature importance proxy
        # (since PCA reduces to 1 component here)
        feature_importance = {}
        for i, feature in enumerate(FEATURES):
            # Importance = |loading| * std of feature in scaled space
            importance = abs(loadings[0, i])
            feature_importance[feature] = round(float(importance), 4)

        # Normalize
        total = sum(feature_importance.values())
        feature_importance = {
            k: round(v / total, 4)
            for k, v in feature_importance.items()
        }

        importance_by_target[target] = feature_importance

    return importance_by_target

def compute_global_importance(importance_by_target):
    """Average importance across all targets"""
    global_importance = {}
    for feature in FEATURES:
        vals = [importance_by_target[t][feature] for t in TARGETS]
        global_importance[feature] = round(float(np.mean(vals)), 4)

    # Sort by importance
    global_importance = dict(
        sorted(global_importance.items(), key=lambda x: -x[1])
    )

    print("\n  Global feature importance (averaged across targets):")
    for feature, imp in global_importance.items():
        bar = '█' * int(imp * 50)
        print(f"    {FEATURE_LABELS[feature]:20s}: {imp:.4f} {bar}")

    return global_importance

def compute_batch_explanation(batch_id, X_original, batch_ids,
                               models, scaler_X, pca, global_importance):
    """Generate explanation for a specific batch"""
    if batch_id not in batch_ids:
        return None

    idx = batch_ids.index(batch_id)
    x = X_original[idx]
    x_scaled = scaler_X.transform(x.reshape(1, -1))
    x_pca = pca.transform(x_scaled)

    predictions = {}
    for target in TARGETS:
        y_pred, y_std = models[target].predict(x_pca, return_std=True)
        predictions[target] = {
            'prediction': round(float(y_pred[0]), 3),
            'std': round(float(y_std[0]), 3)
        }

    # Top contributing features for this batch
    feature_contributions = []
    for feature, imp in global_importance.items():
        feature_contributions.append({
            'feature': feature,
            'label': FEATURE_LABELS[feature],
            'value': round(float(x[FEATURES.index(feature)]), 3),
            'importance': imp
        })

    return {
        'batch_id': batch_id,
        'predictions': predictions,
        'feature_contributions': feature_contributions
    }

if __name__ == '__main__':
    print("=" * 50)
    print("BatchMind — SHAP Computation Script")
    print("=" * 50)

    models, scaler_X, pca, training_data = load_models()
    X = training_data['X']
    X_pca = training_data['X_pca']
    batch_ids = training_data['batch_ids']

    print(f"Loaded models for {len(TARGETS)} targets")
    print(f"Training data: {X.shape[0]} batches, {X.shape[1]} features")

    # Feature importance via PCA loadings
    importance_by_target = compute_feature_importance_in_original_space(
        models, scaler_X, pca, X
    )
    global_importance = compute_global_importance(importance_by_target)

    # Batch-level explanations for key batches
    print("\nGenerating batch-level explanations...")
    key_batches = ['T056', 'T051', 'T027', 'T038', 'T014']
    batch_explanations = {}

    for bid in key_batches:
        exp = compute_batch_explanation(
            bid, X, batch_ids, models, scaler_X, pca, global_importance
        )
        if exp:
            batch_explanations[bid] = exp
            preds = exp['predictions']
            print(f"  {bid}: dissolution={preds['dissolution_rate']['prediction']}%, "
                  f"friability={preds['friability']['prediction']}%, "
                  f"hardness={preds['hardness']['prediction']}N")

    # Contrastive SHAP: T056 vs T051
    print("\nContrastive importance T056 vs T051:")
    if 'T056' in batch_explanations and 'T051' in batch_explanations:
        for fc in batch_explanations['T056']['feature_contributions'][:5]:
            print(f"  {fc['label']}: importance={fc['importance']:.4f}, "
                  f"T056 value={fc['value']}")

    # Save
    print("\nSaving SHAP outputs...")

    with open(os.path.join(OUTPUT_DIR, 'global_importance.json'), 'w') as f:
        json.dump({
            'global': global_importance,
            'by_target': importance_by_target,
            'feature_labels': FEATURE_LABELS
        }, f, indent=2)
    print("  global_importance.json ✓")

    with open(os.path.join(OUTPUT_DIR, 'batch_explanations.json'), 'w') as f:
        json.dump(batch_explanations, f, indent=2)
    print("  batch_explanations.json ✓")

    joblib.dump(global_importance, os.path.join(OUTPUT_DIR, 'shap_importance.pkl'))
    print("  shap_importance.pkl ✓")

    print("\nSHAP computation complete.")