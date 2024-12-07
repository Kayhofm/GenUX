import React, { useState } from "react";
import { streamOpenAIContent } from "../services/openaiService";

function ControlPanel({ onContentGenerated, prompt, setPrompt }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
            handleGenerate(); // Call the function
          }
        }}
        placeholder="Enter your prompt..."
        rows="4"
        cols="50"
      />
      <br /> <br />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate Content"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default ControlPanel;
