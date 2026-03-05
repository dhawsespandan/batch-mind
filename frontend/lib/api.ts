const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function get(path: string) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function post(path: string, body: object) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  // Dashboard
  getOverview: () => get('/dashboard/overview'),
  getPhaseEnergy: () => get('/dashboard/phase-energy'),
  getBatchScatter: () => get('/dashboard/batch-scatter'),
  getCausalDag: () => get('/dashboard/causal-dag'),
  getModelStats: () => get('/dashboard/model-stats'),

  // Predict
  getAllBatches: () => get('/predict/all-batches'),
  getBatchPrediction: (id: string) => get(`/predict/batch/${id}`),
  predictBatch: (params: object) => post('/predict/batch', params),
  getContrastive: (a: string, b: string) => get(`/predict/contrastive/${a}/${b}`),

  // Optimize
  getFeasibilityEnvelope: () => get('/optimize/feasibility-envelope'),
  optimizeParameters: (weights: object) => post('/optimize/parameters', { weights }),

  // Signatures
  getSignatures: () => get('/signatures/'),
  getSignature: (id: string) => get(`/signatures/${id}`),
  submitApproval: (data: object) => post('/signatures/approval', data),
  getApprovalHistory: () => get('/signatures/approvals/history'),

  // Copilot
  chat: (message: string, history: object[], context?: object) =>
    post('/copilot/chat', { message, history, context: context || {} }),
  getSuggestions: () => get('/copilot/suggestions'),
}