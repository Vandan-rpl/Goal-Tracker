/**
 * ============================================================
 * In-memory fixed-window rate limiter
 * Counts are kept per Node process and reset when the backend restarts;
 * that is enough for a single EC2 instance. Move to a shared store (e.g.
 * Redis) if the backend ever runs as more than one process.
 * ============================================================
 */

/**
 * @param {object} options
 * @param {number} options.windowMs  window length
 * @param {number} options.max       hits allowed per key in one window
 * @returns {{ hit: (key: string) => boolean }}  hit() records one hit and
 *          returns false when the key is over the limit
 */
const createRateLimiter = ({ windowMs, max }) => {
    const windows = new Map();

    // Drop finished windows so the map does not grow forever.
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of windows) {
            if (entry.resetAt <= now) {
                windows.delete(key);
            }
        }
    }, windowMs);
    sweep.unref();

    const hit = (key) => {
        const now = Date.now();
        const entry = windows.get(key);

        if (!entry || entry.resetAt <= now) {
            windows.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }

        entry.count += 1;
        return entry.count <= max;
    };

    return { hit };
};

module.exports = {
    createRateLimiter,
};
