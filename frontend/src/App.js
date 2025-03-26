import React, { useState, useCallback } from "react";
import './App.css';
// import "./styles/debug.css";

const ControlPanel = React.lazy(() => import('./components/ControlPanel'));
const UISection = React.lazy(() => import('./components/UISection'));

function App() {
  const [content, setContent] = useState([]); // Store rendered components
  const [prompt, setPrompt] = useState(""); // User input prompt

  // Wrap setContent in useCallback for stability
  const handleContentGenerated = useCallback((newContent) => {
    setContent(newContent);
  }, []); // No dependencies, ensuring a stable reference

  return (
    <div className="App">
      <header className="App-header">
        <h1>Generative UX</h1>
      </header>
      <main className="App-main">
        <section className="Control-panel-section">
          <React.Suspense fallback={<div>Loading Control Panel...</div>}>
            <ControlPanel
              onContentGenerated={handleContentGenerated}
              prompt={prompt}
              setPrompt={setPrompt}
            />
          </React.Suspense>
        </section>
        <section className="UI-section" style={{ width: '480px', marginLeft: '20px' }}>
          <React.Suspense fallback={<div>Loading UI...</div>}>
            <UISection content={content} onContentGenerated={handleContentGenerated} />
          </React.Suspense>
        </section>
      </main>
    </div>
  );
}

export default App;