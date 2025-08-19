import API_CONFIG from '../config/api';

export async function streamOpenAIContent(prompt, onData) {
  const API_URL = `${API_CONFIG.BASE_URL}/api/generate?prompt=${encodeURIComponent(prompt)}`;

  // Pre-check with HEAD request to detect rate limits or server errors
  try {
    const headResponse = await fetch(API_URL, { method: 'HEAD' });
    if (!headResponse.ok) {
      const error = new Error("Pre-check failed");
      error.status = headResponse.status;
      throw error;
    }
  } catch (err) {
    console.error("Pre-check error:", err);
    if (err.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    } else {
      throw new Error("Server error. Please try again later.");
    }
  }

  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(API_URL);

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        resolve();
      } else {
        try {
          const jsonData = JSON.parse(event.data);
          onData(jsonData);
        } catch (err) {
          console.error("Invalid JSON data:", event.data);
        }
      }
    };

    eventSource.onerror = (error) => {
      console.error("Stream error:", error);
      eventSource.close();
      reject(new Error("Streaming failed. Please try again."));
    };
  });
}