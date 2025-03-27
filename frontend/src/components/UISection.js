import React, { useEffect, useState } from "react";
import DynamicRenderer from "./DynamicRenderer";
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

function UISection({ content, onContentGenerated, ...props }) {
  const [imageMap, setImageMap] = useState({}); // Store matched image URLs
  const theme = useTheme();

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:4000/api/images/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
        display: "flex", // added flex display to render components side by side
        flexWrap: "wrap", // allow wrapping if needed
        backgroundColor: theme.palette.background.default,
        width: "480px", // added fixed width
        ...props.style
      }}
    >
      {content
        .filter(component => component && component.type && component.props) // ignore theme-only messages
        .map((component, index) => (
          <DynamicRenderer
            key={index}
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
      ))}
    </Box>
  );
}

export default UISection;
