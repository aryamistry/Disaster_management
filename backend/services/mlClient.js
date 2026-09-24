/**
 * backend/services/mlClient.js
 *
 * Thin HTTP client wrapping the Python ml-service.
 * URL configurable via ML_SERVICE_URL env var (default: http://localhost:8000).
 * Throws MlServiceError on any failure so riskEngine.js can detect and fall back.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT_MS = 30_000;

export class MlServiceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MlServiceError';
    this.cause = cause;
  }
}

/**
 * Run batch prediction on an array of feature objects.
 * @param {Array<Object>} records  — array of 16-feature objects (human-readable values)
 * @returns {Promise<Array<{ grid_id, probability, risk_level, model_version }>>}
 */
export async function mlPredict(records) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new MlServiceError(`ml-service returned ${res.status}: ${text}`);
    }

    const json = await res.json();
    return json.predictions; // Array of { grid_id, probability, risk_level, model_version, features_used }

  } catch (err) {
    if (err instanceof MlServiceError) throw err;
    if (err.name === 'AbortError') {
      throw new MlServiceError(`ml-service request timed out after ${TIMEOUT_MS}ms`, err);
    }
    throw new MlServiceError(`ml-service unreachable: ${err.message}`, err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch ml-service health status.
 * Returns null (not throws) if unavailable — used for admin health panel.
 */
export async function mlHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
