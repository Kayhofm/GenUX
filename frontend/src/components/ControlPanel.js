import React, { useState } from "react";
import { streamOpenAIContent } from "../services/openaiService";

function ControlPanel({ onContentGenerated, prompt, setPrompt }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState("gpt-4o-mini");

  // New method to send updated model to server
  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setModel(newModel);
    fetch("http://localhost:4000/api/set-model", {
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
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{ marginTop: '8px', display: 'block', marginLeft: 'auto' }}
      >
        {loading ? "Generating..." : "Generate Content"}
      </button>
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: '20px', textAlign: 'left' }}>
        <label htmlFor="model-dropdown" style={{ marginRight: '8px' }}>Model</label>
        <select id="model-dropdown" value={model} onChange={handleModelChange}>
          <option value="gpt-4o-2024-11-20">gpt-4o-2024</option>
          <option value="gpt-4o">gpt-4o</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4-turbo">gpt-4-turbo</option>
        </select>
      </div>
    </div>
  );
}

export default ControlPanel;
