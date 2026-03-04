import os
import sys
import numpy as np
import joblib
from supabase import create_client
from dotenv import load_dotenv
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern, WhiteKernel
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import mean_absolute_percentage_error

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

FEATURES = [
    'granulation_time', 'binder_amount', 'drying_temp', 'drying_time',
    'compression_force', 'machine_speed', 'lubricant_conc', 'moisture_content'
]

TARGETS = [
    'dissolution_rate', 'friability', 'hardness',
    'disintegration_time', 'tablet_weight', 'content_uniformity'
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend', 'ml')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def fetch_data():
    print("Fetching data from Supabase...")
    result = supabase.table('batches').select(
        'batch_id,' + ','.join(FEATURES) + ',' + ','.join(TARGETS)
    ).execute()
    data = result.data
    print(f"  Fetched {len(data)} records")
    return data

def build_matrices(data):
    X, Y, batch_ids = [], [], []
    for row in data:
        x = [float(row[f]) for f in FEATURES]
        y = [float(row[t]) for t in TARGETS]
        if not any(v is None for v in x + y):
            X.append(x)
            Y.append(y)
            batch_ids.append(row['batch_id'])
    return np.array(X), np.array(Y), batch_ids

def train_gpr(X_scaled, y, target_name):
    kernel = Matern(nu=2.5) + WhiteKernel(noise_level=0.1)
    gpr = GaussianProcessRegressor(
        kernel=kernel,
        n_restarts_optimizer=5,
        normalize_y=True,
        alpha=1e-6
    )
    gpr.fit(X_scaled, y)
    return gpr

def loo_validate(X_scaled, Y, models, scaler_y_list):
    print("\n  Leave-One-Out Validation:")
    loo = LeaveOneOut()
    all_errors = {t: [] for t in TARGETS}

    for train_idx, test_idx in loo.split(X_scaled):
        X_train, X_test = X_scaled[train_idx], X_scaled[test_idx]
        for i, target in enumerate(TARGETS):
            y_train = Y[train_idx, i]
            y_test = Y[test_idx, i]
            kernel = Matern(nu=2.5) + WhiteKernel(noise_level=0.1)
            gpr = GaussianProcessRegressor(
                kernel=kernel,
                normalize_y=True,
                alpha=1e-6
            )
            gpr.fit(X_train, y_train)
            y_pred, _ = gpr.predict(X_test, return_std=True)
            error = abs(y_pred[0] - y_test[0]) / abs(y_test[0]) * 100
            all_errors[target].append(error)

    results = {}
    for target in TARGETS:
        mape = np.mean(all_errors[target])
        accuracy = 100 - mape
        results[target] = {'mape': round(mape, 2), 'accuracy': round(accuracy, 2)}
        print(f"    {target}: MAPE={mape:.2f}% | Accuracy={accuracy:.2f}%")

    avg_accuracy = np.mean([r['accuracy'] for r in results.values()])
    print(f"\n    Average Accuracy: {avg_accuracy:.2f}%")
    return results

def compute_conformal(X_scaled, Y, models):
    print("\n  Computing Conformal Prediction calibration...")
    n = len(X_scaled)
    cal_size = max(12, int(n * 0.2))
    cal_idx = np.random.choice(n, cal_size, replace=False)

    nonconformity_scores = {t: [] for t in TARGETS}

    for idx in cal_idx:
        X_cal = X_scaled[idx:idx+1]
        for i, target in enumerate(TARGETS):
            y_true = Y[idx, i]
            y_pred, y_std = models[target].predict(X_cal, return_std=True)
            score = abs(y_true - y_pred[0]) / (y_std[0] + 1e-8)
            nonconformity_scores[target].append(score)

    quantiles = {}
    for target in TARGETS:
        scores = np.array(nonconformity_scores[target])
        quantiles[target] = {
            'q90': float(np.quantile(scores, 0.90)),
            'q95': float(np.quantile(scores, 0.95))
        }
        print(f"    {target}: q90={quantiles[target]['q90']:.3f}, q95={quantiles[target]['q95']:.3f}")

    return quantiles

if __name__ == '__main__':
    print("=" * 50)
    print("BatchMind — GPR Training Script")
    print("=" * 50)

    data = fetch_data()
    X, Y, batch_ids = build_matrices(data)
    print(f"  Feature matrix: {X.shape}")

    # Scale features
    print("\nScaling features...")
    scaler_X = StandardScaler()
    X_scaled = scaler_X.fit_transform(X)

    # PCA
    print("Applying PCA...")
    pca = PCA(n_components=0.96)
    X_pca = pca.fit_transform(X_scaled)
    print(f"  PCA components: {X_pca.shape[1]} (capturing 96% variance)")

    # Train one GPR per target
    print("\nTraining GPR models...")
    models = {}
    for i, target in enumerate(TARGETS):
        print(f"  Training {target}...")
        y = Y[:, i]
        gpr = train_gpr(X_pca, y, target)
        models[target] = gpr
        print(f"    Done. Kernel: {gpr.kernel_}")

    # LOO Validation
    loo_results = loo_validate(X_pca, Y, models, None)

    # Conformal calibration
    conformal_quantiles = compute_conformal(X_pca, Y, models)

    # Save everything
    print("\nSaving models to backend/ml/...")
    joblib.dump(models, os.path.join(OUTPUT_DIR, 'gpr_models.pkl'))
    joblib.dump(scaler_X, os.path.join(OUTPUT_DIR, 'scaler_X.pkl'))
    joblib.dump(pca, os.path.join(OUTPUT_DIR, 'pca.pkl'))
    joblib.dump(conformal_quantiles, os.path.join(OUTPUT_DIR, 'conformal.pkl'))
    joblib.dump(loo_results, os.path.join(OUTPUT_DIR, 'loo_results.pkl'))
    joblib.dump({'features': FEATURES, 'targets': TARGETS}, os.path.join(OUTPUT_DIR, 'metadata.pkl'))
    joblib.dump(
        {'X': X, 'Y': Y, 'X_scaled': X_scaled, 'X_pca': X_pca, 'batch_ids': batch_ids},
        os.path.join(OUTPUT_DIR, 'training_data.pkl')
    )

    print("  gpr_models.pkl ✓")
    print("  scaler_X.pkl ✓")
    print("  pca.pkl ✓")
    print("  conformal.pkl ✓")
    print("  loo_results.pkl ✓")
    print("  training_data.pkl ✓")
    print("\nGPR training complete.")