// logService.js
import fs from 'fs';
import path from 'path';

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

export function logInteraction({ type, prompt, result, ip, model, id }) {
  rotateIfNeeded();
  const logEntry = {
    timestamp: new Date().toLocaleString("en-US", { 
      timeZone: "America/Los_Angeles", 
      timeZoneName: "short" 
    }),
    type,
    prompt,
    result,
    model,
    ip,
    id
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(logFilePath, logLine);
}
