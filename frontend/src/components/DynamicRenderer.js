import React, { useState } from "react";
import { Typography, Button, Fab, Box, TextField, Avatar, ListItem, ListItemAvatar, ListItemText, IconButton, CardMedia, Slider, Checkbox, Switch, List } from '@mui/material';
import * as Icons from '@mui/icons-material';
import { useFormContext } from '../context/FormContext';
import API_CONFIG from '../config/api';

function DynamicRenderer({ component, onContentGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { formValues, updateFormValue, getFormValues, clearFormValues } = useFormContext();

  const handleInputChange = (id, value) => {
    if (!id) {
      console.error('No ID provided for input change');
      return;
    }
    console.log(`Setting form value for ID: ${id}, value: ${value}`);
    updateFormValue(id, value);
  };

  const parseRichText = (text) => (
    text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <React.Fragment key={j}>{part}</React.Fragment>
          )
        )}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ))
  );

  const handleClick = () => {
    if (["button", "iconButton", "icon"].includes(component.type)) {
      const currentFormValues = getFormValues();
      console.log('Form values at click:', currentFormValues);
      
      // Only proceed if we have form values
      const formDescription = Object.entries(currentFormValues)
        .filter(([_, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      console.log('Form description:', formDescription);
      setLoading(true);

      // Creation of prompt based on button click
      const label = component.type === "iconButton" || component.type === "icon"
        ? `the ${component.props.content} icon`
        : `the button that says: "${component.props.content}"`;

      const buttonPrompt = `The user clicked ${label}${
        formDescription ? `. Form values are: ${formDescription}` : ''
      }`;

      const ID = component.props.ID || null;

      // Reset content before fetching new data
      onContentGenerated([]);

      // fetch("http://localhost:4000/api/button-click", {
      fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BUTTON_CLICK}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: buttonPrompt, ID: ID }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch from the server");
          }
          // Clear form values only after successful API call
          clearFormValues();
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

  const handleFunction = () => {
    if (component.type === "function") {

      setLoading(true);

      // Only include form values in prompt if they exist
      const functionPrompt = component.props.products;

      // Reset content before fetching new data
      onContentGenerated([]);

      // fetch("http://localhost:4000/api/button-click", {
      fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BUTTON_CLICK}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: functionPrompt }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch from the server");
          }
          // Clear form values only after successful API call
          clearFormValues();
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
    "1": 60,
    "2": 140,
    "3": 220,
    "4": 300,
    "6": 460,
  };
  const width = widths[props.columns] || 220; // Default to 220 if no match

  switch (type) {
    case "header":
      return (
        <Typography
          variant="h5"
          color="text.primary"
          className={`${type} fade-in`}
          sx={{ width: `${width}px`, margin: '10px 10px' }}
        >
          {parseRichText(props.content)}
        </Typography>
      );
    case "subheader":
      return (
        <Typography
          variant="body1"
          color="text.primary"
          style={{ fontSize: '1.1rem', fontWeight: 500 }}
          className={`${type} fade-in`}
          sx={{ width: `${width}px`, margin: '0px 10px' }}
        >
          {parseRichText(props.content)}
        </Typography>
      );
    case "text":
      return (
        <Typography
          variant="body1"
          color="text.primary"
          className={`${type} fade-in`}
          sx={{ width: `${width}px`, margin: '4px 10px' }}
        >
          {parseRichText(props.content)}
        </Typography>
      );
    case "button":
      return (
        <Button
          variant="contained"
          color={props.variant === "secondary" ? "secondary" : "primary"}  // defaults to "primary"
          className={`${type} fade-in`}
          sx={{ width: `${width}px`, margin: '10px 10px', maxHeight: '61px' }}
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
            {loading ? "Loading..." : (IconComponent ? <IconComponent /> : <Icons.HelpOutline />)}
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
        sx={{ 
          width: `${width}px`,
          height: `${width}px`,
          margin: '10px 10px',
          objectFit: 'contain',
          backgroundColor: 'white',
        }}
      />;
    case "borderImage":
      return <Box
        component="img"
        src={props.imageSrc || "/img/default-image.png"}
        alt={props.content}
        className={`${type} fade-in`}
        sx={{ 
          width: `calc(${width}px - 4px)`,  // Subtract 2px border from each side
          height: `calc(${width}px - 4px)`, // Subtract 2px border from each side
          margin: '10px 10px',
          objectFit: 'contain',
          backgroundColor: 'white',
          border: (theme) => `2px solid ${theme.palette.primary.main}60`,  // 60 for 60% transparency
          borderRadius: '4px'
        }}
      />;
    case "textInput":
      const inputId = props.ID || props.id;
      return <TextField
        type="text"
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, margin: '10px 10px' }}
        placeholder={props.content || "Text"}
        variant="outlined"
        value={formValues[inputId] || ''}
        onChange={(e) => handleInputChange(inputId, e.target.value)}
      />;
    case "list-item":
      return (
        <ListItem
          className={`${type} fade-in`}
          style={{ width: `${width}px`, margin: '10px 10px', display: "flex" }}
        >
          <ListItemAvatar>
            <Avatar
              src={props.imageSrc || "/img/default-image.png"}
              alt={""}
              style={{ width: `40px` }}
            />
          </ListItemAvatar>
          <ListItemText
            primary={
              <Typography color="text.primary">
                {parseRichText(props.content)}
              </Typography>
            }
          />
        </ListItem>
      );
    case "slider":
      const sliderId = props.ID || props.id;
      return (
        <Box
          sx={{ 
            width: `${width}px`, 
            margin: '10px 10px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-start' 
          }}
          className={`${type} fade-in`}
        >
          <Typography
            variant="body2"
            color="text.primary"
            sx={{ marginBottom: '4px', fontWeight: 500 }}
          >
            {props.content || "Slider"}
          </Typography>
          <Slider
            value={formValues[sliderId] ?? props.value ?? 50}
            onChangeCommitted={(e, value) => handleInputChange(sliderId, value)}
            min={props.min || 0}
            max={props.max || 100}
            sx={{ width: '100%' }}
          />
        </Box>
      );
    case "space":
      return <Box
        className={`${type} fade-in`}
        sx={{ width: `${width}px`, margin: '10px 10px' }}
        >
        {"\u00A0"}
      </Box>;
  case "checkbox":
    const checkboxId = props.ID || props.id;
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: `${width}px`,
          margin: '10px 10px'
        }}
      >
        <Checkbox 
          {...props} 
          sx={{ padding: '0 8px 0 0' }}
          checked={formValues[checkboxId] || false}
          onChange={(e) => handleInputChange(checkboxId, e.target.checked)}
        />
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="body1"
            align="left"
            sx={{
              wordWrap: 'break-word',
              whiteSpace: 'normal',
              lineHeight: 1.4,
            }}
          >
            {props.content}
          </Typography>
        </Box>
      </Box>
    );
    case "switch":
      const switchId = props.ID || props.id;
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: `${width}px`,
              margin: '10px 10px'
            }}
            className={`${type} fade-in`}
          >
            <Switch
              checked={formValues[switchId] || false}
              onChange={(e) => handleInputChange(switchId, e.target.checked)}
            />
            <Typography variant="body1" sx={{ ml: 1 }}>
              {props.content}
            </Typography>
          </Box>
        );
      case "remove":
      if (props.ID) {
        onContentGenerated(prev => prev.filter(item => item.props?.ID !== props.ID));
      }
      return null;
    default:
      return <Typography variant="body1">Unsupported component type: {type}</Typography>;
  }
}

export default DynamicRenderer;
