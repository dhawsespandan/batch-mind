import os
import sys
import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

# sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from state import get_models

router = APIRouter()

FEATURES = [
    'granulation_time', 'binder_amount', 'drying_temp', 'drying_time',
    'compression_force', 'machine_speed', 'lubricant_conc', 'moisture_content'
]

TARGETS = [
    'dissolution_rate', 'friability', 'hardness',
    'disintegration_time', 'tablet_weight', 'content_uniformity'
]

REGULATORY_LIMITS = {
    'dissolution_rate':    {'min': 85.0,  'max': None},
    'friability':          {'min': None,  'max': 1.0},
    'hardness':            {'min': 50.0,  'max': None},
    'disintegration_time': {'min': None,  'max': 15.0},
    'tablet_weight':       {'min': 195.0, 'max': 207.0},
    'content_uniformity':  {'min': 85.0,  'max': 115.0},
}

class PredictRequest(BaseModel):
    granulation_time: float
    binder_amount: float
    drying_temp: float
    drying_time: float
    compression_force: float
    machine_speed: float
    lubricant_conc: float
    moisture_content: float
    confidence_level: Optional[float] = 0.95

@router.post("/batch")
def predict_batch(req: PredictRequest):
    m = get_models()
    gpr_models = m['gpr']
    scaler_X = m['scaler_X']
    pca = m['pca']
    conformal = m['conformal']

    x = np.array([[
        req.granulation_time, req.binder_amount, req.drying_temp,
        req.drying_time, req.compression_force, req.machine_speed,
        req.lubricant_conc, req.moisture_content
    ]])

    x_scaled = scaler_X.transform(x)
    x_pca = pca.transform(x_scaled)

    predictions = {}
    all_compliant = True

    for target in TARGETS:
        y_pred, y_std = gpr_models[target].predict(x_pca, return_std=True)
        y_pred = float(y_pred[0])
        y_std = float(y_std[0])

        q = conformal[target]['q95'] if req.confidence_level >= 0.95 \
            else conformal[target]['q90']
        interval = y_std * q

        lower = round(y_pred - interval, 3)
        upper = round(y_pred + interval, 3)

        limits = REGULATORY_LIMITS[target]
        compliant = True
        if limits['min'] and lower < limits['min']:
            compliant = False
        if limits['max'] and upper > limits['max']:
            compliant = False

        if not compliant:
            all_compliant = False

        predictions[target] = {
            'predicted': round(y_pred, 3),
            'std': round(y_std, 3),
            'lower': lower,
            'upper': upper,
            'compliant': compliant
        }

    # Feasibility check
    cf = req.compression_force
    envelope = m['feasibility_envelope']
    in_feasible_zone = (
        envelope['compression_force_min'] <= cf <= envelope['compression_force_max']
    )

    return {
        'predictions': predictions,
        'feasible': in_feasible_zone and all_compliant,
        'all_regulatory_compliant': all_compliant,
        'feasibility_envelope': envelope,
        'input_params': req.dict()
    }

@router.get("/batch/{batch_id}")
def get_batch_prediction(batch_id: str):
    m = get_models()
    intervals = m['prediction_intervals']
    compliance = m['compliance_results']

    if batch_id not in intervals:
        return {"error": f"Batch {batch_id} not found"}

    return {
        'batch_id': batch_id,
        'predictions': intervals[batch_id],
        'compliance': compliance.get(batch_id, {}),
        'explanation': m['batch_explanations'].get(batch_id, {})
    }

@router.get("/all-batches")
def get_all_predictions():
    m = get_models()
    intervals = m['prediction_intervals']
    compliance = m['compliance_results']

    summary = []
    for batch_id, preds in intervals.items():
        summary.append({
            'batch_id': batch_id,
            'dissolution_rate': preds['dissolution_rate']['predicted'],
            'friability': preds['friability']['predicted'],
            'hardness': preds['hardness']['predicted'],
            'disintegration_time': preds['disintegration_time']['predicted'],
            'tablet_weight': preds['tablet_weight']['predicted'],
            'content_uniformity': preds['content_uniformity']['predicted'],
            'fully_compliant': compliance.get(batch_id, {}).get('fully_compliant', False)
        })

    return {'batches': summary, 'total': len(summary)}

@router.get("/contrastive/{batch_a}/{batch_b}")
def contrastive_explain(batch_a: str, batch_b: str):
    m = get_models()

    if batch_a == 'T056' and batch_b == 'T051':
        return m['contrastive_default']

    intervals = m['prediction_intervals']
    training_data = m['training_data']
    batch_ids = training_data['batch_ids']
    X = training_data['X']
    FEATURE_LIST = m['metadata']['features']

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

    if batch_a not in batch_ids or batch_b not in batch_ids:
        return {"error": "One or both batch IDs not found"}

    idx_a = batch_ids.index(batch_a)
    idx_b = batch_ids.index(batch_b)

    diffs = {}
    for i, feat in enumerate(FEATURE_LIST):
        val_a = float(X[idx_a, i])
        val_b = float(X[idx_b, i])
        diffs[feat] = {
            'label': FEATURE_LABELS.get(feat, feat),
            'batch_a_value': round(val_a, 3),
            'batch_b_value': round(val_b, 3),
            'absolute_diff': round(val_a - val_b, 3)
        }

    feature_diffs = {f: abs(diffs[f]['absolute_diff']) for f in FEATURE_LIST}
    main_driver = max(feature_diffs, key=feature_diffs.get)

    preds_a = intervals.get(batch_a, {})
    preds_b = intervals.get(batch_b, {})

    return {
        'batch_a': batch_a,
        'batch_b': batch_b,
        'diffs': diffs,
        'main_driver': main_driver,
        'main_driver_label': FEATURE_LABELS.get(main_driver, main_driver),
        'main_driver_diff': diffs[main_driver]['absolute_diff'],
        'predictions_a': {t: preds_a[t]['predicted'] for t in TARGETS if t in preds_a},
        'predictions_b': {t: preds_b[t]['predicted'] for t in TARGETS if t in preds_b},
    }