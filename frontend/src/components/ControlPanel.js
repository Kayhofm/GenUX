import React, { useState, useEffect } from "react";
import { streamOpenAIContent } from "../services/openaiService";
import API_CONFIG from '../config/api';

function ControlPanel({ onContentGenerated, prompt, setPrompt }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState("gpt-4o-mini");
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setPrompt((current) => current + ' ' + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }
  }, [setPrompt]);

  const toggleListening = () => {
    if (!recognition) return;
    
    if (isListening) {
      recognition.stop();
    } else {
      setPrompt(''); // Clear the input field before starting voice input
      recognition.start();
      setIsListening(true);
    }
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setModel(newModel);
    // fetch("http://localhost:4000/api/set-model", {
    fetch(`${API_CONFIG.BASE_URL}/api/set-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: newModel })
    })
      .then((res) => res.json())
      .then((data) => console.log("Model updated:", data))
      .catch((err) => console.error("Failed to update model:", err));
  };

  const handleGenerate = () => {
    setLoading(true);
    setError(null);
    onContentGenerated([]); // Clear previous content

    streamOpenAIContent(prompt, (data) => {
      onContentGenerated((prev) => [...prev, data]); // Append received components
    })
      .catch((err) => {
        setError("Failed to generate content. Please try again.");
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="control-panel">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // Prevents creating a new line in the textarea
            handleGenerate();
          }
        }}
        placeholder="Enter your prompt..."
        rows="4"
        cols="50"
        style={{ width: '100%' }}
      />
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={toggleListening}
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: isListening ? 'red' : 'inherit',
          }}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? 'Stop' : 'Voice Input'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Content"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: '20px', textAlign: 'left' }}>
        <label htmlFor="model-dropdown" style={{ marginRight: '8px' }}>Model</label>
        <select id="model-dropdown" value={model} onChange={handleModelChange}>
          <option value="gpt-4.1">gpt-4.1</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          <option value="gpt-5-mini">gpt-5-mini</option>
          <option value="gpt-5-nano">gpt-5-nano</option>
        </select>
      </div>
    </div>
  );
}

export default ControlPanel;
