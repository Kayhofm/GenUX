import API_CONFIG from '../config/api';

export function streamOpenAIContent(prompt, onData) {
  return new Promise((resolve, reject) => {
    // const API_URL = `http://localhost:4000/api/generate?prompt=${encodeURIComponent(prompt)}`;
    const API_URL = `${API_CONFIG.BASE_URL}/api/generate?prompt=${encodeURIComponent(prompt)}`;

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
      reject(error);
    };
  });
}
