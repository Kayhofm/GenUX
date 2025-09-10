import React, { useEffect, useState } from "react";
import DynamicRenderer from "./DynamicRenderer";
import { Box, Fade } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import API_CONFIG from '../config/api';

function UISection({ content, onContentGenerated, ...props }) {
  const [imageMap, setImageMap] = useState({}); // Store matched image URLs
  const theme = useTheme();

  useEffect(() => {
    // const eventSource = new EventSource("http://localhost:4000/api/images/stream");
    const eventSource = new EventSource(`${API_CONFIG.BASE_URL}/api/images/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Setting image URL:", data.imgEventID);
        if (data.imgEventID && data.imageUrl) {
          setImageMap((prevMap) => ({
            ...prevMap,
            [data.imgEventID]: data.imageUrl,
          }));
        }
      } catch (err) {
        console.error("Error parsing SSE data:", event.data, err);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <Box
      {...props}
      style={{
        display: "flex",
        flexWrap: "wrap",
        backgroundColor: theme.palette.background.default,
        width: "480px",
        ...props.style
      }}
    >
      {content
        .filter(component => component && component.type && component.props) // ignore theme-only messages
        .map((component, index) => {
          const key = component.props?.ID ?? index;
          const delayMs = Math.min(index * 40, 320); // subtle stagger
          return (
            <Fade in timeout={220} style={{ transitionDelay: `${delayMs}ms` }} key={key}>
              <div>
                <DynamicRenderer
                  component={{
                    ...component,
                    props: {
                      ...component.props,
                      imageSrc: component.props.imageID 
                        ? (imageMap[component.props.imageID] || component.props.imageSrc || "/img/default-image.png")
                        : (component.props.imageSrc || "/img/default-image.png"),
                    },
                  }}
                  onContentGenerated={onContentGenerated}
                />
              </div>
            </Fade>
          );
        })}
    </Box>
  );
}

export default UISection;
