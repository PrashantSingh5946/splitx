/**
 * Minimal fixed-window in-memory rate limiter (no external deps).
 *
 * Note: state is per-process. On serverless (Vercel) each warm instance keeps
 * its own counters — still effective against brute force from a single source,
 * but not a substitute for infra-level limits on a large deployment.
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, message = "Too many requests, please try again later" } = {}) {
  const hits = new Map(); // key → { count, resetAt }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.headers["x-forwarded-for"] || "unknown";

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (hits.size > 10000) {
      for (const [k, v] of hits) {
        if (now >= v.resetAt) hits.delete(k);
      }
    }

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ status: false, message });
    }
    next();
  };
}

module.exports = { rateLimit };
