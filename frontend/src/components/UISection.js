import React, { useEffect, useState } from "react";
import DynamicRenderer from "./DynamicRenderer";
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import API_CONFIG from '../config/api';
import { Analytics } from "@vercel/analytics/react"

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
      <Analytics/>
    </Box>
  );
}

export default UISection;
