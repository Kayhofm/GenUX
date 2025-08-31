import React, { useState } from "react";
import { Typography, Button, Fab, Box, TextField, Avatar, ListItem, ListItemAvatar, ListItemText, IconButton, Slider, Checkbox, Switch } from '@mui/material';
import * as Icons from '@mui/icons-material';
import { useFormContext } from '../context/FormContext';
import API_CONFIG from '../config/api';
import { useImageEventStream } from '../hooks/useImageEventStream';

function DynamicRenderer({ component, onContentGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { formValues, updateFormValue, getFormValues, clearFormValues } = useFormContext();

  const { reconnectIfNeeded } = useImageEventStream((imageData) => {
    onContentGenerated((prev) => [...prev, imageData]);
  });

  const handleInputChange = (id, value) => {
    if (!id) {
      console.error('No ID provided for input change');
      return;
    }
    updateFormValue(id, value);
  };

  const parseRichText = (text) =>
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
    ));

  const getSafeProps = (props) => {
    const { ID, imageSrc, ...rest } = props;
    return rest;
  };

  const handleClick = () => {
    if (["button", "iconButton", "icon"].includes(component.type)) {
      reconnectIfNeeded();

      const currentFormValues = getFormValues();
      const formDescription = Object.entries(currentFormValues)
        .filter(([_, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      setLoading(true);

      const label = component.type === "iconButton" || component.type === "icon"
        ? `the ${component.props.content} icon`
        : `the button that says: "${component.props.content}"`;

      const buttonPrompt = `The user clicked ${label}${formDescription ? `. Form values are: ${formDescription}` : ''}`;
      const ID = component.props.ID || null;

      onContentGenerated([]);

      fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BUTTON_CLICK}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: buttonPrompt, ID }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Failed to fetch from the server");
          clearFormValues();
          return response.body.getReader();
        })
        .then((reader) => {
          const decoder = new TextDecoder();
          let buffer = "";

          function read() {
            reader.read().then(({ done, value }) => {
              if (done) {
                setLoading(false);
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop();

              lines.forEach((line) => {
                if (line.startsWith("data:")) {
                  const jsonData = line.slice(5).trim();
                  try {
                    if (jsonData === "[DONE]") return;
                    const parsedData = JSON.parse(jsonData);
                    onContentGenerated((prev) => [...prev, parsedData]);
                  } catch (error) {
                    console.error("Error parsing streamed data:", error);
                  }
                }
              });

              read();
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
    reconnectIfNeeded();

    if (component.type === "function") {
      setLoading(true);
      const functionPrompt = component.props.products;
      onContentGenerated([]);

      fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BUTTON_CLICK}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: functionPrompt }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Failed to fetch from the server");
          clearFormValues();
          return response.body.getReader();
        })
        .then((reader) => {
          const decoder = new TextDecoder();
          let buffer = "";

          function read() {
            reader.read().then(({ done, value }) => {
              if (done) {
                setLoading(false);
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop();

              lines.forEach((line) => {
                if (line.startsWith("data:")) {
                  const jsonData = line.slice(5).trim();
                  try {
                    if (jsonData === "[DONE]") return;
                    const parsedData = JSON.parse(jsonData);
                    onContentGenerated((prev) => [...prev, parsedData]);
                  } catch (error) {
                    console.error("Error parsing streamed data:", error);
                  }
                }
              });

              read();
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
  const safeProps = getSafeProps(props);

  const widths = { "1": 60, "2": 140, "3": 220, "4": 300, "6": 460 };
  const width = widths[props.columns] || 220;

  switch (type) {
    case "header":
      return (
        <Typography
          variant="h5"
          sx={{
            width,
            m: '10px',
            textAlign: 'left'
          }}
        >
          {parseRichText(props.content)}
        </Typography>
      );

    case "subheader":
      return (
        <Typography
          variant="h6"
          sx={{
            width,
            m: '6px 10px',
            textAlign: 'left'
          }}
        >
          {parseRichText(props.content)}
        </Typography>
      );

    case "text":
      return (
        <Typography
          variant="body1"
          sx={{
            width,
            m: '4px 10px',
            textAlign: 'left'
          }}
        >
          {parseRichText(props.content)}
        </Typography>
      );
      case "button":
      return <Button variant="contained" color={props.variant === "secondary" ? "secondary" : "primary"} sx={{ width, m: '10px', maxHeight: '61px' }} onClick={handleClick} disabled={loading}>{loading ? "Loading..." : props.content}</Button>;
    case "iconButton": {
      const iconName = props.content.charAt(0).toUpperCase() + props.content.slice(1);
      const IconComponent = Icons[iconName];
      return <Fab color="primary" onClick={handleClick} disabled={loading} sx={{ m: '10px 12px' }}>{loading ? "Loading..." : (IconComponent ? <IconComponent /> : <Icons.HelpOutline />)}</Fab>;
    }
    case "icon": {
      const iconName = props.content.charAt(0).toUpperCase() + props.content.slice(1);
      const IconComponent = Icons[iconName];
      return (
        <Box sx={{ width, m: '4px 10px', display: 'flex', justifyContent: 'center' }}>
          <IconButton color="primary" onClick={handleClick} disabled={loading}>
            {loading ? "Loading..." : IconComponent ? <IconComponent /> : <Typography>{props.content}</Typography>}
          </IconButton>
        </Box>
      );
    }
    case "avatar":
      return <Avatar src={typeof props.imageSrc === 'string' ? props.imageSrc : "/img/default-image.png"} alt={props.content} sx={{ width, height: width, m: '10px' }} />;
    case "image":
    case "borderImage":
      return <Box component="img" src={typeof props.imageSrc === 'string' ? props.imageSrc : "/img/default-image.png"} alt={props.content} sx={{
        width: type === "borderImage" ? `calc(${width}px - 4px)` : width,
        height: type === "borderImage" ? `calc(${width}px - 4px)` : width,
        m: '10px',
        objectFit: 'contain',
        backgroundColor: 'white',
        ...(type === "borderImage" && {
          border: (theme) => `2px solid ${theme.palette.primary.main}60`,
          borderRadius: '4px'
        })
      }} />;
    case "textInput": {
      const inputId = props.ID || props.id;
      return <TextField type="text" sx={{ width, m: '10px' }} placeholder={props.content || "Text"} variant="outlined" value={formValues[inputId] || ''} onChange={(e) => handleInputChange(inputId, e.target.value)} />;
    }
    case "list-item":
      return (
        <ListItem sx={{ width, m: '4px 10px', py: '4px', alignItems: 'center' }}>
          <ListItemAvatar>
            <Avatar src={typeof props.imageSrc === 'string' ? props.imageSrc : "/img/default-image.png"} alt="" sx={{ width: 40, height: 40 }} />
          </ListItemAvatar>
          <ListItemText primary={<Typography variant="body1" sx={{ lineHeight: 1.3, mt: '2px' }}>{parseRichText(props.content)}</Typography>} sx={{ m: 0 }} />
        </ListItem>
      );
    case "slider": {
      const sliderId = props.ID || props.id;
      return (
        <Box sx={{ width, m: '10px', backgroundColor: (theme) => theme.palette.grey[300], borderRadius: '8px', p: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ mb: '4px', fontWeight: 500 }}>{props.content || "Slider"}</Typography>
          <Slider value={formValues[sliderId] ?? props.value ?? 50} onChange={(e, value) => handleInputChange(sliderId, value)} min={props.min || 0} max={props.max || 100} sx={{ width: '100%' }} />
        </Box>
      );
    }
    case "space":
      return <Box sx={{ width, m: '10px' }}>{"\u00A0"}</Box>;
    case "checkbox": {
      const checkboxId = props.ID || props.id;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', width, m: '10px' }}>
          <Checkbox {...safeProps} checked={formValues[checkboxId] || false} onChange={(e) => handleInputChange(checkboxId, e.target.checked)} sx={{ pr: '8px' }} />
          <Typography variant="body1" align="left" sx={{ wordWrap: 'break-word', lineHeight: 1.4 }}>{props.content}</Typography>
        </Box>
      );
    }
    case "switch": {
      const switchId = props.ID || props.id;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', width, m: '10px' }}>
          <Switch checked={formValues[switchId] || false} onChange={(e) => handleInputChange(switchId, e.target.checked)} />
          <Typography variant="body1" sx={{ ml: 1 }}>{props.content}</Typography>
        </Box>
      );
    }
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