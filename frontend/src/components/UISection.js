
import React, { useEffect, useState } from "react";
import DynamicRenderer from "./DynamicRenderer";

function UISection({ content, onContentGenerated }) {
  const [imageMap, setImageMap] = useState({}); // Store matched image URLs

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:4000/api/images/stream");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.imgEventID && data.imageUrl) {
        setImageMap((prevMap) => ({
          ...prevMap,
          [data.imgEventID]: data.imageUrl,
        }));
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
    <div className="main-page">
      {content.map((component, index) => (
        <DynamicRenderer
          key={index}
          component={{
            ...component,
            props: {
              ...component.props,
              imageSrc: imageMap[component.props.imageID] || component.props.imageSrc || "/img/default-image.png",
            },
          }}
          onContentGenerated={onContentGenerated}
        />
      ))}
    </div>
  );
}

export default UISection;
