import React, { useState, useCallback, useEffect } from "react";
import './App.css';
import { ThemeProvider } from '@mui/material/styles';
import { defaultTheme, darkTheme, natureTheme, modernTheme } from './themes';
import { FormProvider } from './context/FormContext';
import { Box, Typography } from '@mui/material';
import { Analytics, track } from "@vercel/analytics/react"

const ControlPanel = React.lazy(() => import('./components/ControlPanel'));
const UISection = React.lazy(() => import('./components/UISection'));

function App() {
  const [content, setContent] = useState([]); // Store rendered components
  const [prompt, setPrompt] = useState(""); // User input prompt
  const [currentTheme, setCurrentTheme] = useState(defaultTheme); // Manage theme with state
  const [rationale, setRationale] = useState("Rationale");

  // Handle theme changes separately
  useEffect(() => {
    // Handle theme
    if (content && content[0]?.theme) {
      const themeValue = content[0].theme;
      const themeMap = { defaultTheme, darkTheme, natureTheme, modernTheme };
      setCurrentTheme(themeMap[themeValue] || defaultTheme);
    }

    // Find rationale component in the array
    const rationaleComponent = content.find(item => item?.type === 'rationale');
    if (rationaleComponent) {
      setRationale(rationaleComponent.content);
    }
  }, [content]);

  // Handle content generation from ControlPanel
  const handleContentGenerated = useCallback((newContent) => {
    setContent(newContent);

    /* Custom event for analytics
    track('ui_generated', {
      componentCount: newContent.length,
      theme: newContent[0]?.theme || 'default',
    });
    */
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
                <Box
                  sx={{ 
                    textAlign: 'left',
                    margin: '0px 0px',
                    padding: '10px'
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Rationale
                  </Typography>
                  {Array.isArray(rationale) 
                    ? rationale.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))
                    : rationale}
                </Box>
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
      <Analytics/>
    </FormProvider>
  );
}

export default App;