/**
 * ZetaSports Resilient Network Fetch Engine
 * Features jittered exponential backoff, configurable timeout (5s default),
 * Cloudflare 522 failover, and early exit on non-retryable 4xx errors.
 */

/**
 * Calculates exponential backoff delay with random jitter.
 * @param {number} attempt Current retry attempt index (0, 1, 2...)
 * @param {number} baseDelayMs Base delay in milliseconds
 * @param {number} maxDelayMs Maximum ceiling for delay
 * @returns {number}
 */
function calculateBackoffDelay(attempt, baseDelayMs = 400, maxDelayMs = 4000) {
  const expDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(maxDelayMs, expDelay);
  const jitter = Math.random() * (baseDelayMs * 0.3); // Up to 30% jitter
  return Math.round(cappedDelay + jitter);
}

/**
 * Executes a resilient fetch request with exponential backoff and timeout safeguards.
 * @param {string} url 
 * @param {RequestInit} [options={}] 
 * @param {Object} [config={}]
 * @param {number} [config.maxRetries=3]
 * @param {number} [config.baseDelayMs=300]
 * @param {number} [config.maxDelayMs=3000]
 * @param {number} [config.timeoutMs=5000]
 * @param {Function} [config.customFetch=fetch]
 * @param {Function} [config.sleepFn] Custom delay resolver
 * @returns {Promise<Response>}
 */
async function fetchWithResilientBackoff(url, options = {}, config = {}) {
  const maxRetries = config.maxRetries !== undefined ? config.maxRetries : 3;
  const baseDelayMs = config.baseDelayMs !== undefined ? config.baseDelayMs : 300;
  const maxDelayMs = config.maxDelayMs !== undefined ? config.maxDelayMs : 3000;
  const timeoutMs = config.timeoutMs !== undefined ? config.timeoutMs : 5000;
  const activeFetch = config.customFetch || fetch;
  const sleep = config.sleepFn || (ms => new Promise(resolve => setTimeout(resolve, ms)));

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    let timeoutId = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`REQUEST_TIMEOUT: Response exceeded ${timeoutMs}ms`));
      }, timeoutMs);

      const mergedOptions = {
        ...options,
        signal: controller.signal
      };

      const response = await activeFetch(url, mergedOptions);
      clearTimeout(timeoutId);

      // Success
      if (response.ok) {
        return response;
      }

      // Non-retryable 4xx client errors (except 429 Too Many Requests)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`CLIENT_ERROR: HTTP ${response.status} non-retryable client error`);
      }

      // Retryable 5xx errors or 429 Rate Limit or 522 Cloudflare Timeout
      const errorMsg = `SERVER_ERROR: HTTP ${response.status} on attempt ${attempt + 1}`;
      lastError = new Error(errorMsg);
      lastError.status = response.status;

      attempt++;
      if (attempt > maxRetries) {
        throw new Error(`HTTP_ERROR: HTTP ${response.status} after ${maxRetries} retry attempts`);
      }

      const delay = calculateBackoffDelay(attempt - 1, baseDelayMs, maxDelayMs);
      await sleep(delay);

    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      // Do not retry client errors
      if (err.message && err.message.startsWith('CLIENT_ERROR:')) {
        throw err;
      }

      lastError = err;
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }

      const delay = calculateBackoffDelay(attempt - 1, baseDelayMs, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError || new Error(`Network request failed after ${maxRetries} attempts`);
}

/**
 * Executes a resilient request attempting a primary URL, and on failure (e.g. 522 Cloudflare),
 * fails over sequentially across backup/proxy URLs.
 * @param {Array<string>} urls 
 * @param {RequestInit} [options={}] 
 * @param {Object} [config={}]
 * @returns {Promise<{ response: Response, resolvedUrl: string, attempts: number }>}
 */
async function fetchWithProxyFailover(urls, options = {}, config = {}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('NO_URLS_PROVIDED: Must provide at least one target URL');
  }

  const errors = [];
  let totalAttempts = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      // 1 retry per fallback node to allow quick failover
      const singleConfig = {
        ...config,
        maxRetries: config.maxRetriesPerNode !== undefined ? config.maxRetriesPerNode : 1
      };
      const res = await fetchWithResilientBackoff(url, options, singleConfig);
      totalAttempts++;
      return { response: res, resolvedUrl: url, attempts: totalAttempts };
    } catch (err) {
      totalAttempts++;
      errors.push({ url, error: err.message });
      // Proceed to next fallback URL in list
    }
  }

  const errorSummary = errors.map(e => `[${e.url} => ${e.error}]`).join(', ');
  throw new Error(`ALL_PROXIES_FAILED: All ${urls.length} proxy endpoints failed: ${errorSummary}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateBackoffDelay,
    fetchWithResilientBackoff,
    fetchWithProxyFailover
  };
}
