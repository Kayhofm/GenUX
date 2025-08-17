// import dotenv from "dotenv";
// dotenv.config(); // Load environment variables

if (process.env.NODE_ENV !== 'production') {
  import('dotenv').then(dotenv => dotenv.config());
}

// Debug environment loading
console.log('=== ENVIRONMENT DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
console.log('OPENAI_API_KEY first 10 chars:', process.env.OPENAI_API_KEY?.substring(0, 10));
console.log('========================');

import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import fs from 'fs';

// Fixed JSON imports - read files instead of using import with syntax
const prompts = JSON.parse(fs.readFileSync('./prompts.json', 'utf8'));
const toolDefinition = JSON.parse(fs.readFileSync('./toolDefinition.json', 'utf8'));

import { generateImage, generateImageDalle, getImageStore, imageEventEmitter } from "./imageCreator.js";
import { getAmazonProducts } from "./toolAmazon.js";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

let openai;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.error("❌ OPENAI_API_KEY is missing from environment variables");
  process.exit(1);
}

const tools = toolDefinition;

const app = express();

// Updated CORS configuration for production
app.use(cors({
  origin: [
    'http://localhost:3000',                    // Development
    'https://your-vercel-app.vercel.app',       // Replace with your actual Vercel URL
    'https://your-custom-domain.com'            // If you have a custom domain
  ],
  credentials: true
}));

app.use(express.json());

const systemPrompt01 = fs.readFileSync('systemPrompt.txt', 'utf8');
const userPrompt01 = prompts.userPrompt01;
let sessionMessages = {}; // Store messages keyed by session ID or user ID
if(!sessionMessages[999]) sessionMessages[999] = 0;
let imgID;

// Global variable for model
let currentModel = "gpt-4o-mini";

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const generateContent = async (prompt, res) => {
  if(!sessionMessages[9999]) {
    sessionMessages[9999] = 1;
  } else {
    sessionMessages[9999]++;
  };
  const sessionId = sessionMessages[9999];

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log("New request: ", prompt);

    const sessionIds = [sessionId - 2, sessionId - 1, sessionId]; // Include multiple sessions
    const contextWindow = sessionIds
      .map(id => sessionMessages[id] || "") // Map to message content
      .join(""); // Concatenate all messages

    const response = await openai.chat.completions.create({
      model: currentModel,
      messages: [
        { role: "system", content: systemPrompt01 },
        { role: "user", content: userPrompt01 + prompt},
        { role: "assistant", content: contextWindow }, // Add full previous response
      ],
      tools,
      tool_choice: "auto",
      // response_format: {"type": "json_object"},
      // temperature: 0.7, // Controls randomness in the output
      // top_p: 0.9, // Controls diversity via nucleus sampling
      // max_tokens: 500,
      // presence_penalty: 0.6, // -2 to +2, Increases the likelihood of exploring new topics
      // frequency_penalty: -1, // -2 to +2, Decreases the likelihood of repeating phrases
      stream: true,
    });

    let buffer = ""; // Accumulate fragments of JSON
    let fullMessage = "";
    let toolCallBuffer = null; // Buffer for tool calls

    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta;
      
      // Handle tool calls
      if (delta?.tool_calls) {
        const toolCall = delta.tool_calls[0];
        if (!toolCallBuffer) {
          toolCallBuffer = {
            name: toolCall.function?.name || '',
            arguments: toolCall.function?.arguments || ''
          };
        } else {
          if (toolCall.function?.arguments) {
            toolCallBuffer.arguments += toolCall.function.arguments;
          }
        }

        // Try to parse complete function call
        try {
          const args = JSON.parse(toolCallBuffer.arguments);
          console.log("Completing function call:", toolCallBuffer.name, args);
          
          console.log("Sending wait component\n");
          res.write(`data: ${JSON.stringify({
            type: "text",
            props: {
              content: "\n Retrieving data, please wait...",
              ID: "9999",
              columns: "6"
            }
          })}\n\n`);

          if (toolCallBuffer.name === 'get_products') {
            const products = await getAmazonProducts(args.query);
            
            // Create a new OpenAI chat completion for processing the products
            console.log("Generating UI components for products");
            const productResponse = await openai.chat.completions.create({
              model: currentModel,
              messages: [
                { role: "system", content: systemPrompt01 },
                { role: "user", content: `Generate UI components with these products to respond to the user prompt: ${JSON.stringify(products.results)}. The original user prompt was: `, prompt },
                { role: "assistant", content: contextWindow }
              ],
              stream: true,
            });

            // Process the streaming response using the same buffer logic as the main content
            let productBuffer = "";

            console.log("Removing wait component\n");
            res.write(`data: ${JSON.stringify({
              type: "remove",
              props: {
                ID: "9999",
              }
            })}\n\n`);

            for await (const chunk of productResponse) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                productBuffer += content;
                try {
                  // Use the same JSON parsing logic as the main content stream
                  let tempBuffer = productBuffer;
                  if (tempBuffer.startsWith('[')) {
                    tempBuffer = tempBuffer.slice(1); // Remove the first character
                  }
                  if (tempBuffer.endsWith(']')) {
                    tempBuffer = tempBuffer.slice(0, -1); // Remove the last character
                  }
                  if (tempBuffer.endsWith(',')) {
                    tempBuffer = tempBuffer.slice(0, -1); // Remove the last comma
                  } else if (tempBuffer.charAt(tempBuffer.length - 2) === ',') {
                    tempBuffer = tempBuffer.slice(0, -2) + tempBuffer.slice(-1); // Remove the second-to-last comma
                  } else if (tempBuffer.charAt(tempBuffer.length - 3) === ',') {
                    tempBuffer = tempBuffer.slice(0, -3) + tempBuffer.slice(-2); // Remove the third-to-last comma
                  }
                  
                  tempBuffer = `[${tempBuffer}]`;
                  
                  try {
                    const tempParsedData = JSON.parse(tempBuffer);
                    if (Array.isArray(tempParsedData)) {
                      tempParsedData.forEach(item => {
                        if (item.type === "image") {
                          item.type = "borderImage";
                        }
                        if (item.type === "list-item") {
                          if (typeof imgID === "undefined" || imgID === null) {
                            imgID = 1000;
                          } else {
                            imgID++;
                          }
                          
                          item.props.imageSrc = "";
                          item.props.imageID = imgID;
                          
                          // Request image from imageCreator
                          // Generate the image and update the item's props
                          try {
                            const imageUrl = generateImage(imgID, item.props.columns, item.props.content || "a broken image");
                          } catch (error) {
                            console.error("Error generating image:", error.message);
                            item.props.imageSrc = "/img/default-image.png"; // Fallback image
                          }
                        }
                        console.log("Sending function component:\n", item);
                        res.write(`data: ${JSON.stringify(item)}\n\n`);
                      });
                      productBuffer = "";
                    }
                  } catch (error) {
                    // Incomplete JSON, continue accumulating
                  }
                } catch (err) {
                  continue;
                }
              }
            }
            toolCallBuffer = null;
          }
        } catch (error) {
          // If JSON.parse fails, we don't have complete arguments yet
          if (!(error instanceof SyntaxError)) {
            console.error("Function execution error:", error);
          }
        }
      }
      
      // Handle regular content
      else if (delta?.content) {
        buffer += delta.content;
        fullMessage += delta.content;

        try {
          let tempBuffer = buffer;

          // Remove leading `[` and trailing `]` or `,` if present
          if (tempBuffer.startsWith('[')) {
            tempBuffer = tempBuffer.slice(1); // Remove the first character
          }
          if (tempBuffer.endsWith(']')) {
            tempBuffer = tempBuffer.slice(0, -1); // Remove the last character
          }
          if (tempBuffer.endsWith(',')) {
            tempBuffer = tempBuffer.slice(0, -1); // Remove the last comma
          } else if (tempBuffer.charAt(tempBuffer.length - 2) === ',') {
            tempBuffer = tempBuffer.slice(0, -2) + tempBuffer.slice(-1); // Remove the second-to-last comma
          } else if (tempBuffer.charAt(tempBuffer.length - 3) === ',') {
            tempBuffer = tempBuffer.slice(0, -3) + tempBuffer.slice(-2); // Remove the third-to-last comma
          }

          tempBuffer = `[${tempBuffer}]`; // Re-wrap in array format
          
          // Try parsing the accumulated buffer to detect valid JSON
          try {
            const tempParsedData = JSON.parse(tempBuffer);
          
            if (Array.isArray(tempParsedData)) {
              // Send each new component individually
              tempParsedData.forEach(async (item, index) => {
               
                if (item.type === "image" || item.type === "list-item") {
                  if (typeof imgID === "undefined" || imgID === null) {
                    imgID = 1;
                  } else {
                    imgID++;
                  }
                  
                  item.props.imageSrc = "";
                  item.props.imageID = imgID;
                  
                  // Request image from imageCreator
                  // Generate the image and update the item's props
                  try {
                    const imageUrl = generateImage(imgID, item.props.columns, item.props.content || "a broken image");
                  } catch (error) {
                    console.error("Error generating image:", error.message);
                    item.props.imageSrc = "/img/default-image.png"; // Fallback image
                  }
                }

                console.log("Sending component:\n", item);
                res.write(`data: ${JSON.stringify(item)}\n\n`);
              });

              buffer = ""; // Clear buffer after sending all components
            }
          } catch (error) {
            // console.error("Error parsing tempBuffer:", error.message);
          }
        } catch (err) {
          // If parsing fails, it means the data is incomplete, continue accumulating
          continue;
        }
      }
    }
    res.write("data: [DONE]\n\n"); // Signal completion
    res.end();

    // Save full message to session store
    sessionMessages[sessionId+1] = "\nUser prompt: " + prompt + "\nAssistant response:\n" + fullMessage;

  } catch (error) {
    console.error("Streaming Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate content." });
  }
// });
};

app.get("/api/generate", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).send("Prompt is required");
  }
  await generateContent(prompt, res);
});

app.post("/api/generate-image", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const imageUrl = await generateImage(prompt);
    res.status(200).json({ imageUrl, message: "Image generated successfully!" });
  } catch (error) {
    console.error("Error generating image:", error.message);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

app.post("/api/button-click", async (req, res) => {
  const { content } = req.body;
  console.log("Button click attempted with content:", JSON.stringify(content));

  if (!content || typeof content === 'object') {
    console.log("Rejected button click due to invalid content type");
    return res.status(400).json({ error: "Invalid button content" });
  }

  console.log("Button clicked with content:", content);

  try {
    const buttonPrompt = "The user clicked the button that says: \"" + content + "\". Generate a new UI based on this button click.";
    await generateContent(buttonPrompt, res);
  } catch (error) {
    console.error("Error generating content for button click:", error.message);
    res.status(500).json({ error: "Failed to generate content for button click" });
  }
});

let clients = []; // Track connected SSE clients

// SSE endpoint to notify about new images
app.get("/api/images/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Add client to the list
  clients.push(res);

  // Remove client on disconnect
  req.on("close", () => {
    // console.log("SSE client disconnected");
    clients = clients.filter((client) => client !== res);
  });
});

// Listen for new images and notify clients
imageEventEmitter.on("newImage", (imageUrl, imgEventID) => {
  console.log("New image, notifying clients. imgID:", imgID, " imgEventID: ", imgEventID);

  // Notify all connected clients
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify({ imageUrl, imgEventID })}\n\n`);
  });
});

// Endpoint to generate an image
app.post("/api/images/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const imageUrl = await generateImage(prompt);
    res.status(200).json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint to update model
app.post("/api/set-model", (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: "Model is required" });
  }
  currentModel = model;
  console.log("Model updated to:", currentModel);
  res.status(200).json({ message: "Model updated", model: currentModel });
});

// Updated port configuration for Railway
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});