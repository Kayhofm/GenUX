import React, { useState, useCallback, useEffect } from "react";
import './App.css';
import { ThemeProvider } from '@mui/material/styles';
import { defaultTheme, darkTheme, natureTheme, modernTheme } from './themes';
import { FormProvider } from './context/FormContext';

const ControlPanel = React.lazy(() => import('./components/ControlPanel'));
const UISection = React.lazy(() => import('./components/UISection'));

function App() {
  const [content, setContent] = useState([]); // Store rendered components
  const [prompt, setPrompt] = useState(""); // User input prompt
  const [currentTheme, setCurrentTheme] = useState(defaultTheme); // Manage theme with state

  // Handle theme changes separately
  useEffect(() => {
    if (content && content[0]?.theme) {
      const themeValue = content[0].theme;
      const themeMap = { defaultTheme, darkTheme, natureTheme, modernTheme };
      setCurrentTheme(themeMap[themeValue] || defaultTheme);
    }
  }, [content]);

  // Handle content generation from ControlPanel
  const handleContentGenerated = useCallback((newContent) => {
    setContent(newContent);
  }, []);

  return (
    <FormProvider>
      <ThemeProvider theme={currentTheme}>
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
            <section className="UI-section" 
              style={{ 
                width: '480px', 
                marginLeft: '20px', 
                backgroundColor: currentTheme.palette.background.default 
              }}>
              <React.Suspense fallback={<div>Loading UI...</div>}>
                <UISection content={content} onContentGenerated={handleContentGenerated} />
              </React.Suspense>
            </section>
          </main>
        </div>
      </ThemeProvider>
    </FormProvider>
  );
}

export default App;