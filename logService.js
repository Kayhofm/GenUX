// logService.js
import fs from 'fs';
import path from 'path';
import { createClient as createRedisClient } from 'redis';

const logFilePath = './logs/interaction_logs.txt';
fs.mkdirSync('./logs', { recursive: true }); // ensure the folder exists

const MAX_LOG_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_LOG_FILES = 10; // keep at most 10 rotated files

function formatTimestampForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function rotateIfNeeded() {
  try {
    if (fs.existsSync(logFilePath)) {
      const { size } = fs.statSync(logFilePath);
      if (size >= MAX_LOG_SIZE_BYTES) {
        const ts = formatTimestampForFilename();
        const rotatedName = path.join(path.dirname(logFilePath), `interaction_logs.${ts}.txt`);
        fs.renameSync(logFilePath, rotatedName);

        // Prune old rotated files (keep the most recent MAX_LOG_FILES)
        const dir = path.dirname(logFilePath);
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith('interaction_logs.') && f.endsWith('.txt'))
          .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t);
        const toDelete = files.slice(MAX_LOG_FILES);
        toDelete.forEach(({ f }) => {
          try { fs.unlinkSync(path.join(dir, f)); } catch {}
        });
      }
    }
  } catch (e) {
    // If rotation fails, continue logging without crashing
    console.warn('Log rotation check failed:', e.message);
  }
}

const REDIS_RETRY_COOLDOWN_MS = 60 * 1000;
let redisRetryAfter = 0;
let redisConnecting = null;

// Shared Redis client. Gives up quickly when Redis is unreachable (instead of
// retrying forever) and returns null, so callers can fall back to file logs.
export async function getRedisClient() {
  if (globalThis.__redisClient?.isReady) return globalThis.__redisClient;
  if (Date.now() < redisRetryAfter) return null;
  if (redisConnecting) return redisConnecting;

  redisConnecting = (async () => {
    const client = createRedisClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => (retries >= 3 ? new Error('Redis unreachable') : 500),
      },
    });
    client.on('error', () => {}); // failures are handled via connect()/commands below
    try {
      await client.connect();
      globalThis.__redisClient = client;
      return client;
    } catch (e) {
      console.warn(`Redis unavailable (${e.message}); using file logs for ${REDIS_RETRY_COOLDOWN_MS / 1000}s`);
      redisRetryAfter = Date.now() + REDIS_RETRY_COOLDOWN_MS;
      client.disconnect().catch(() => {});
      return null;
    } finally {
      redisConnecting = null;
    }
  })();
  return redisConnecting;
}

export async function logInteraction({ type, prompt, result, ip, model, id }) {
  const useRedis = !!process.env.REDIS_URL || process.env.USE_REDIS === '1';
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    prompt,
    result,
    model,
    ip,
    id
  };

  // Redis (TCP) logging if configured; falls back to file if unreachable
  if (useRedis) {
    try {
      const r = await getRedisClient();
      if (r) {
        await r.lPush('logs', JSON.stringify(logEntry));
        await r.lTrim('logs', 0, 49999);
        return;
      }
    } catch (e) {
      console.warn('Redis logging failed, falling back:', e.message);
      // fall through to file
    }
  }

  // No KV path; if Redis is not enabled/available, fall back to file

  // File-based logging (local/dev)
  rotateIfNeeded();
  try {
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFilePath, logLine);
  } catch (e) {
    console.warn('File logging failed:', e.message);
  }
}

export { logFilePath };
