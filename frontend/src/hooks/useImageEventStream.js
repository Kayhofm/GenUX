import { useRef, useEffect } from 'react';

export function useImageEventStream(onImage) {
  const eventSourceRef = useRef(null);
  const lastConnectTimeRef = useRef(0);

  const connect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/images/stream");
    eventSourceRef.current = es;
    lastConnectTimeRef.current = Date.now();

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onImage(data);
      } catch (err) {
        console.error("Error parsing image stream:", err);
      }
    };

    es.onerror = (event) => {
      console.error("Image stream error:", event);
      es.close();
      eventSourceRef.current = null;
    };
  };

  const reconnectIfNeeded = () => {
    const now = Date.now();
    if (!eventSourceRef.current || now - lastConnectTimeRef.current > 1000) {
      connect();
    }
  };

  // ✅ Clean up the event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { connect, reconnectIfNeeded };
}