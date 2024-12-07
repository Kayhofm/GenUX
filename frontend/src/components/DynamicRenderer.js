import React, { useState } from "react";

function DynamicRenderer({ component, onContentGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State to store the fetched image URLs
  // const [images, setImages] = useState([]);
  // const [imageUrl, setImageUrl] = useState(null);

  // State to store the streamed components
  // const [activeComponent, setActiveComponent] = useState(component);

  // const comp = activeComponent.component || activeComponent; // Use active component
  // console.log("imageID: ", comp.props.imageID)

  
  const handleClick = () => {
    if (component.type === "button") {
      setLoading(true);
      const buttonPrompt = `The user clicked the button that says: "${component.props.content}". Generate a new UI based on this button click.`;
  
      // Clear previous content
      onContentGenerated([]); // Reset content before fetching new data

      fetch("http://localhost:4000/api/button-click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: buttonPrompt }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch from the server");
          }
          return response.body.getReader();
        })
        .then((reader) => {
          const decoder = new TextDecoder();
          let buffer = "";
  
          // Process the streamed response
          function read() {
            reader.read().then(({ done, value }) => {
              if (done) {
                setLoading(false);
                console.log("Streaming complete.");
                return;
              }
  
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop(); // Save the last incomplete line to buffer
  
              lines.forEach((line) => {
                if (line.startsWith("data:")) {
                  const jsonData = line.slice(5).trim(); // Remove "data:" prefix
                  try {
                    if (jsonData === "[DONE]") {
                      console.log("Streaming complete."); // Log completion
                      return; // Exit processing for [DONE]
                    }
                    const parsedData = JSON.parse(jsonData);
                    console.log("Streaming data:", parsedData);
                    onContentGenerated((prev) => [...prev, parsedData]); // Append new data
                  } catch (error) {
                    console.error("Error parsing streamed data:", error);
                  }
                }
              });
  
              read(); // Continue reading
            });
          }
          read();
        })
        .catch((err) => {
          console.error("Error during fetch:", err);
          setError("Failed to fetch content. Please try again.");
          setLoading(false);
        });
    }
  };
  

  if (!component || !component.type || !component.props) {
    return <p>Invalid component structure.</p>;
  }

  const { type, props } = component;

  const widths = {
    "2": 140,
    "3": 220,
    "6": 460,
  };
  const width = widths[props.columns] || 220; // Default to 220 if no match


  switch (type) {
    case "header":
      return <header
      className={`${props.styleClass} fade-in`}
      style={{ width: `${width}px` }}
        >
          {props.content}
        </header>;
    case "text":
      return <div 
      className={`${props.styleClass} fade-in`}
      style={{ width: `${width}px` }}
        >
          {props.content}
        </div>;
    case "button":
      return (
        <button
        className={`${props.styleClass} fade-in`}
          style={{ width: `${width}px` }}
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? "Loading..." : props.content}
        </button>
      );
    case "image":
      // console.log("ImageID: ", props.imageID, "URL: ", props.imageSrc)
      return <img 
        src={props.imageSrc || "/img/default-image.png"} 
        alt={props.content} 
        className={`${type} fade-in`}
        style={{ width: `${width}px` }}
      />;
    case "input":
      return <input
        type="text"
        className={`${props.styleClass} fade-in`}
        style={{ width: `${width}px` }}
        placeholder={props.content || "Input"}
      />
    case "list-item":
      return <list-item
      className={`${props.styleClass} fade-in`}
      style={{ width: `${width}px`, display: "flex" }}
      >
        <div className="icon-container">
          <img
            src={props.imageSrc || "/img/default-image.png"}
            alt={""} 
            style={{ width: `20px` }}
          />
        </div>
        <div className="text-container">
        <span className="typewriter">{props.content || "Default header"}</span>
        </div>
      </list-item>
    default:
      return <p>Unsupported component type: {type}</p>;
  }
}

export default DynamicRenderer;
