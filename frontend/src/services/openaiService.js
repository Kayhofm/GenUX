import API_CONFIG from '../config/api';

export async function streamOpenAIContent(prompt, onData, bypassKey = null, options = {}) {
  // ✅ Use backticks for template literal
  let API_URL = `${API_CONFIG.BASE_URL}/api/generate?prompt=${encodeURIComponent(prompt)}`;

  // ✅ Also wrap this string in backticks and fix &
  if (bypassKey) {
    API_URL += `&bypass=${encodeURIComponent(bypassKey)}`;
  }

  // Removed HEAD pre-check to save an extra round trip.
  // Any rate limits or server errors will be surfaced via the SSE connection.

  const {
    retries = 1,
    retryDelayMs = 500,
    jitterMs = 300,
  } = options;

  return new Promise((resolve, reject) => {
    let attemptsLeft = retries;
    let eventSource;

    const scheduleRetry = () => {
      if (attemptsLeft > 0) {
        const delay = retryDelayMs + Math.floor(Math.random() * jitterMs);
        attemptsLeft -= 1;
        setTimeout(connect, delay);
        return true;
      }
      return false;
    };

    const connect = () => {
      eventSource = new EventSource(API_URL);

      eventSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          eventSource.close();
          resolve();
          return;
        }

        try {
          const jsonData = JSON.parse(event.data);

          console.log("Received message:", jsonData);

          // Handle explicit server-side error payloads
          if (jsonData.type === 'error') {
            // Surface the error to the UI, then close and retry gracefully
            onData(jsonData);
            eventSource.close();
            if (!scheduleRetry()) {
              reject(new Error(jsonData.message || "Streaming failed. Please try again."));
            }
            return;
          }

          // Handle clear message from server
          if (jsonData.type === 'clear') {
            console.log("🧹 Clearing content due to clear message");
            onData([]);
            return;
          }

          // Handle tool_starting message - clear all content like button clicks do
          if (jsonData.type === 'tool_starting') {
            console.log("🧹 Clearing content due to tool_starting");
            onData([]);
            return;
          }

          onData(jsonData);
        } catch (err) {
          console.error("Invalid JSON data:", event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error("Stream error:", error);
        eventSource.close();
        if (!scheduleRetry()) {
          reject(new Error("Streaming failed. Please try again."));
        }
      };
    };

    connect();
  });
}
