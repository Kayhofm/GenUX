// logService.js
import fs from 'fs';

const logFilePath = './logs/interaction_logs.txt';
fs.mkdirSync('./logs', { recursive: true }); // ensure the folder exists

export function logInteraction({ type, prompt, result, ip, model, id }) {
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