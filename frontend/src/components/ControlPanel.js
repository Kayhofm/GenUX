import React, { useState, useEffect } from "react";
import { streamOpenAIContent } from "../services/openaiService";
import API_CONFIG from '../config/api';

function ControlPanel({ onContentGenerated, prompt, setPrompt }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState("gpt-4o-mini");
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [bypassKey, setBypassKey] = useState('');

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
    }, bypassKey)
      .catch((err) => {
        if (err.code === 429) {
          setError("You've hit the request limit. Please wait a few minutes and try again.");
        } else if (err.code >= 500) {
          setError("Server error. Please try again later.");
        } else {
          setError("Failed to generate content. Please try again.");
        }
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
            e.preventDefault();
            handleGenerate();
          }
        }}
        placeholder="Enter your prompt..."
        rows="4"
        cols="50"
        style={{ width: '100%' }}
      />

      {/* Buttons */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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

      {/* Error display */}
      {error && <p className="error" style={{ marginTop: '12px', color: 'red' }}>{error}</p>}

      {/* Intro message */}
      <div style={{ marginTop: '20px', color: '#555', textAlign: 'left'  }}>
        This is an interactive AI demo that generates real-time user interfaces based on your prompt or actions.<br /><br />
        To start, try out these prompts: "I want to cook lasagna" or "Pay my utility bill".
      </div>

      {/* Model dropdown */}
      <div style={{ marginTop: '20px', textAlign: 'left' }}>
        <label htmlFor="model-dropdown" style={{ marginRight: '8px' }}>Model</label>
        <select id="model-dropdown" value={model} onChange={handleModelChange}>
          <option value="gpt-4o">gpt-4o</option>
          <option value="gpt-4o-mini">gpt-4o-mini (fastest)</option>
          <option value="gpt-5-mini">gpt-5-mini</option>
          <option value="gpt-5-nano">gpt-5-nano</option>
        </select>
      </div>

      {/* Bypass key input */}
      <div style={{ marginTop: '20px', textAlign: 'left' }}>
        <input
          type="password"
          placeholder="-"
          value={bypassKey}
          onChange={(e) => setBypassKey(e.target.value)}
          style={{ padding: '4px', width: '140px' }}
        />
      </div>
    </div>
  );
}

export default ControlPanel;
