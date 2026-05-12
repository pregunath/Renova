const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Global state to track rate limit resets across all calls
let globalRateLimitReset = 0;

/**
 * Updates the global rate limit reset time if the new time is further in the future.
 * @param {number} resetTime - timestamp in ms when the limit resets
 */
function setGlobalRateLimit(resetTime) {
  const now = Date.now();
  // Only update if it's in the future and strictly later than our current known reset
  if (resetTime > now && resetTime > globalRateLimitReset) {
    globalRateLimitReset = resetTime;
    const waitSeconds = Math.ceil((resetTime - now) / 1000);
    console.warn(`[Pinterest] Global rate limit hit. Pausing new requests for ${waitSeconds}s until ${new Date(resetTime).toISOString()}`);
  }
}

function createLimiter({ maxInFlight = 1, minTimeMs = 1000 } = {}) {
  const queue = [];
  let activeCount = 0;
  let lastRequestTime = 0;

  const processQueue = () => {
    // 1. If we are at capacity, do nothing
    if (activeCount >= maxInFlight) return;
    
    // 2. If queue is empty, do nothing
    if (queue.length === 0) return;

    const now = Date.now();
    
    // 3. Check global rate limit pause
    if (now < globalRateLimitReset) {
      const wait = globalRateLimitReset - now;
      // Re-schedule processing after the global wait
      setTimeout(processQueue, wait + 100); 
      return;
    }

    // 4. Check per-request spacing (minTimeMs)
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < minTimeMs) {
      const wait = minTimeMs - timeSinceLast;
      setTimeout(processQueue, wait);
      return;
    }

    // 5. Dequeue and run
    const job = queue.shift();
    if (!job) return;

    activeCount++;
    lastRequestTime = Date.now();

    // Execute the job
    job.fn()
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeCount--;
        processQueue();
      });
      
    // 6. Try to start more jobs
    processQueue();
  };

  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

// Tune these if needed. 
// Reduced maxInFlight to 1 and increased minTimeMs to 1000 to be safer by default.
const limitPinterest = createLimiter({
  maxInFlight: 1, 
  minTimeMs: 1000, 
});

function parseRetryAfterMs(res) {
  // 1. Standard Retry-After header (seconds or HttpDate)
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    if (/^\d+$/.test(retryAfter)) {
       return parseInt(retryAfter, 10) * 1000;
    }
    const date = Date.parse(retryAfter);
    if (!isNaN(date)) {
       return Math.max(0, date - Date.now());
    }
  }

  // 2. Pinterest specific x-ratelimit-reset
  const resetHeader = res.headers.get("x-ratelimit-reset");
  if (resetHeader) {
     const val = Number(resetHeader);
     if (!isNaN(val)) {
        // Heuristic: if value is small, it's seconds remaining. If large (year 2000+), it's epoch.
        if (val > 1600000000) {
           // Epoch seconds
           return Math.max(0, (val * 1000) - Date.now());
        } else {
           // Seconds remaining
           return val * 1000;
        }
     }
  }

  return null;
}

async function pinterestFetch(url, init = {}, opts = {}) {
  const {
    maxRetries = 3, // Increased default retries slightly
    timeoutMs = 25_000,
  } = opts;

  return limitPinterest(async () => {
    let attempt = 0;

    while (true) {
      attempt++;

      // Check global limit again inside the job loop
      if (Date.now() < globalRateLimitReset) {
         const wait = globalRateLimitReset - Date.now();
         if (wait > 0) {
            console.log(`[Pinterest] Waiting for global rate limit reset (${Math.ceil(wait/1000)}s)`);
            await sleep(wait + 100);
         }
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      let res;
      try {
        res = await fetch(url, { ...init, signal: controller.signal });
      } catch (err) {
         // Network error handling
         if (attempt > maxRetries) throw err;
         console.warn(`[Pinterest] Network error (Attempt ${attempt}): ${err.message}. Retrying...`);
         await sleep(1000 * attempt); 
         continue;
      } finally {
        clearTimeout(t);
      }

      if (res.status === 429) {
        // Rate limited
        if (attempt > 1 + maxRetries) {
          return res;
        }

        const waitMs = parseRetryAfterMs(res) || (Math.min(60_000, 1000 * Math.pow(2, attempt)) + Math.random() * 500);

        // Update global limiter to stop other requests
        setGlobalRateLimit(Date.now() + waitMs);
        
        console.warn(`[Pinterest] 429 Too Many Requests. Waiting ${Math.round(waitMs / 1000)}s before retry (Attempt ${attempt}/${maxRetries})`);
        
        await sleep(waitMs);
        continue;
      }

      return res;
    }
  });
}

module.exports = { pinterestFetch };
