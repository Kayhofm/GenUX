import React, { useState } from "react";
import { Typography, Button, Fab, Box, TextField, Avatar, ListItem, ListItemAvatar, ListItemText, IconButton, CardMedia, Slider } from '@mui/material';
import * as Icons from '@mui/icons-material';

function DynamicRenderer({ component, onContentGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    return <Typography variant="body1">Invalid component structure.</Typography>;
  }

  const { type, props } = component;

  const widths = {
    "2": 140,
    "3": 220,
    "4": 300,
    "6": 460,
  };
  const width = widths[props.columns] || 220; // Default to 220 if no match

  switch (type) {
    case "header":
      return <Typography
        variant="h5"
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, margin: '10px 10px' }}
      >
        {props.content}
      </Typography>;
    case "text":
      return <Box
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, margin: '10px 10px' }}
        >
        {props.content}
      </Box>;
    case "button":
      return (
        <Button
          variant="contained"
          className={`${type} fade-in`}
          sx={{ width: `${width}px`, margin: '10px 10px' }}
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? "Loading..." : props.content}
        </Button>
      );
    case "iconButton":
      {
        const iconName = props.content.charAt(0).toUpperCase() + props.content.slice(1);
        const IconComponent = Icons[iconName];
        return (
          <Fab
            color="primary"
            className={`${type} fade-in`}
            onClick={handleClick}
            disabled={loading}
            sx={{ margin: '10px 12px' }}
          >
            {loading ? "Loading..." : (IconComponent ? <IconComponent /> : <Typography>{props.content}</Typography>)}
          </Fab>
        );
      }
    case "icon":
      const iconName = props.content.charAt(0).toUpperCase() + props.content.slice(1);
      const IconComponent = Icons[iconName];
      return (
        <IconButton
          color="primary" // set the icon color ("secondary" if needed)
          className={`${type} fade-in`}
          onClick={handleClick}
          disabled={loading}
          sx={{ margin: '10px 20px' }}
        >
          {loading ? "Loading..." : IconComponent ? <IconComponent /> : <Typography>{props.content}</Typography>}
        </IconButton>
      );
    case "avatar":
      return <Avatar
        src={props.imageSrc || "/img/default-image.png"}
        alt={props.content}
        className={`${type} fade-in`}
        style={{ width: `${width}px`, height: `${width}px`, margin: '10px 10px' }}
      />;
    case "image":
      return <Box
        component="img"
        src={props.imageSrc || "/img/default-image.png"}
        alt={props.content}
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, height: `${width}px`, margin: '10px 10px' }}
      />;
    case "textInput":
      return <TextField
        type="text"
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, margin: '10px 10px' }}
        placeholder={props.content || "Text"}
        variant="outlined"
      />;
    case "list-item":
      return <ListItem
        className={`${type} fade-in`}
        style={{ width: `${width}px`, display: "flex" }}
      >
        <ListItemAvatar>
          <Avatar
            src={props.imageSrc || "/img/default-image.png"}
            alt={""}
            style={{ width: `40px` }}
          />
        </ListItemAvatar>
        <ListItemText primary={props.content || "Default header"} />
      </ListItem>;
    case "slider":
      return <Slider
        sx={{ width: `${width}px`, margin: '10px 10px' }}
        defaultValue={props.content || 50}
        min={props.min || 0}
        max={props.max || 100}
        onChangeCommitted={(e, value) => props.onChange && props.onChange(value)}
      />;
    case "space":
      return <Box
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, margin: '10px 10px' }}
        >
        {"\u00A0"}
      </Box>;
    default:
      return <Typography variant="body1">Unsupported component type: {type}</Typography>;
  }
}

export default DynamicRenderer;
