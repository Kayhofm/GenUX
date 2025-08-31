import dotenv from "dotenv";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { logInteraction } from './logService.js';
import { streamClaudeResponse } from './anthropicService.js';

// Fixed JSON imports - read files instead of using import with syntax
const prompts = JSON.parse(fs.readFileSync('./prompts.json', 'utf8'));
const toolDefinition = JSON.parse(fs.readFileSync('./toolDefinition.json', 'utf8'));

import { generateImage, generateImageDalle, getImageStore, imageEventEmitter } from "./imageCreator.js";
import { getAmazonProducts } from "./toolAmazon.js";
import { getYelpBusinesses } from "./toolYelp.js";

let openai;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.error("❌ OPENAI_API_KEY is missing from environment variables");
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

console.log("✅ Environment loaded. Anthropic key:", process.env.ANTHROPIC_API_KEY ? "Present" : "Missing");

const bypassKey = process.env.BYPASS_KEY;
const tools = toolDefinition;

const app = express();
app.set('trust proxy', 1);

// CORS configuration for production
app.use(cors({
  origin: [
    'http://localhost:3000',                    // Development
    'https://gen-ux-seven.vercel.app',          // Vercel URL
    'https://genux-production.up.railway.app'   // Allow Railway URL for testing
  ],
  credentials: true
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: process.env.NODE_ENV !== 'production' ? 500 : 25, // Limit each IP in production to 25 requests per windowMs
  
  message: {
    error: 'Too many requests from this IP. Please try again later.'
  },
  skip: (req, res) => {
    return req.method === 'HEAD' || req.query.bypass === process.env.BYPASS_KEY;
  }
});

const systemPrompt01 = fs.readFileSync('systemPrompt.txt', 'utf8');
const userPrompt01 = prompts.userPrompt01;
let sessionMessages = {}; // Store messages keyed by session ID or user ID
if(!sessionMessages[999]) sessionMessages[999] = 0;
let imgID = 1000;

// Global variable for model
let currentModel = "claude-3-5-haiku-20241022";

// Set model route
app.post("/api/set-model", (req, res) => {
  const { model } = req.body;
  currentModel = model;
  console.log("Model updated to:", model);
  res.json({ success: true, model });
});
/*
const logFilePath = './logs/interaction_logs.txt';
fs.mkdirSync('./logs', { recursive: true }); // ensure the folder exists

// Create a reusable log function
function logInteraction({ type, prompt, result, ip, model, id }) {
  const logEntry = {
    timestamp: new Date().toLocaleString("en-US", { 
      timeZone: "America/Los_Angeles", 
      timeZoneName: "short" 
    }),
    type,
    prompt,
    result,
    model,
    ip,
    id
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(logFilePath, logLine);
}
*/
// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function sendEmailNotification(commentText, ipAddress) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: 'New Comment Received',
    text: `New comment:\n\n${commentText}\n\nFrom IP: ${ipAddress}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error('Email error:', error);
    }
    console.log('✅ Email sent:', info.response);
  });
}

const generateContent = async (prompt, res) => {
  if(!sessionMessages[9999]) {
    sessionMessages[9999] = 1;
  } else {
    sessionMessages[9999]++;
  };
  const sessionId = sessionMessages[9999];
  let messageList = [];

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log("New request: ", prompt);

    const sessionIds = [sessionId - 2, sessionId - 1, sessionId];

    sessionIds.forEach(id => {
      const pair = sessionMessages[id];
      if (Array.isArray(pair)) {
        messageList.push(...pair); // Flatten user+assistant pairs
      }
    });

    // Add current prompt with userPrompt01 prefix
    messageList.push({ role: "user", content: userPrompt01 + prompt });

    console.log("▶ Calling LLM with model:", currentModel);

    if (currentModel.startsWith("claude")) {
      await streamClaudeResponse({
        model: currentModel,
        prompt,
        userPrompt01,
        systemPrompt: systemPrompt01,
        messageList,
        sessionId,
        res,
        sessionMessages,
        imgIDRef: { current: 1000 },
      });
      return;
    }

    /*
    if (currentModel.startsWith("claude")) {
      try {
        console.log("🟣 Claude block triggered");
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

      const stream = await anthropic.messages.stream({
        model: currentModel,
        max_tokens: 2048,
        system: systemPrompt01,
        messages: messageList,
      });
        console.log("🟢 Claude stream opened");

        let buffer = "";
        let fullMessage = "";

        for await (const message of stream) {
          const delta = message.delta?.text;
          // console.log("📨 Claude chunk:", delta);

          if (delta) {
            buffer += delta;
            fullMessage += delta;

            // Try to parse buffer
            let tempBuffer = buffer;

            if (tempBuffer.startsWith("[")) tempBuffer = tempBuffer.slice(1);
            if (tempBuffer.endsWith("]")) tempBuffer = tempBuffer.slice(0, -1);
            if (tempBuffer.endsWith(",")) tempBuffer = tempBuffer.slice(0, -1);

            tempBuffer = `[${tempBuffer}]`;

            try {
              const parsed = JSON.parse(tempBuffer);
              if (Array.isArray(parsed)) {
                parsed.forEach((item) => {

                      // image augmentation logic
                      const needsImage = ["image", "borderImage", "list-item", "avatar"].includes(item.type);
                      const content = item.props?.content || "missing content";
                      const columns = item.props?.columns || 6;

                      if (needsImage && typeof content === "string" && content.trim() !== "") {
                        try {
                          imgID = typeof imgID === "undefined" || imgID === null ? 1000 : imgID + 1;
                          
                          const imageUrl = generateImage(imgID, columns, content);

                          // Only assign image if URL is returned
                          if (imageUrl) {
                            item.props.imageID = imgID;
                            item.props.imageSrc = imageUrl;
                          } else {
                            console.warn("⚠️ generateImage returned empty for:", content);
                            item.props.imageSrc = "/img/default-image.png";
                          }
                        } catch (error) {
                          console.error("❌ Error generating image for:", content, error.message);
                          item.props.imageSrc = "/img/default-image.png";
                        }
                      }

                  res.write(`data: ${JSON.stringify(item)}\n\n`);
                });
                buffer = ""; // reset after flush
              }
            } catch (e) {
              // Continue accumulating
            }
          }
        }

        res.write("data: [DONE]\n\n");
        res.end();

        logInteraction({
          type: "text",
          prompt,
          result: fullMessage,
          model: currentModel,
          ip: res.req.ip,
          id: sessionId
        });

        sessionMessages[sessionId + 1] = [
          { role: "user", content: userPrompt01 + prompt },
          { role: "assistant", content: fullMessage }
        ];
        
        return;
      } catch (error) {
        console.error("Claude Streaming Error:", error.message);
        res.status(500).json({ error: "Failed to generate content with Claude." });
        return;
      }
    }
*/
    const response = await openai.chat.completions.create({
      model: currentModel,
      messages: [
        { role: "system", content: systemPrompt01 },
        ...messageList  // already includes the current user prompt with prefix
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

    console.log("✅ OpenAI responded, starting stream...");

    let buffer = ""; // Accumulate fragments of JSON
    let fullMessage = "";
    let toolCallBuffer = null; // Buffer for tool calls

    for await (const chunk of response) {

      // console.log("📦 Raw chunk received:", JSON.stringify(chunk));

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

          if (toolCallBuffer.name === 'get_yelp') {
            const businesses = await getYelpBusinesses(args.query, args.location || "Seattle, WA");
/*
            const productResponse = await openai.chat.completions.create({
              model: currentModel,
              messages: [
                { role: "system", content: systemPrompt01 },
                { role: "user", content: `Generate UI components from these Yelp listings to respond to the user prompt: ${JSON.stringify(businesses.results)}. The original user prompt was: ${prompt}` },
                { role: "assistant", content: contextWindow }
              ],
              stream: true
            });
*/
            // Reuse session context and add tool results for continuation
            const productMessageList = [
              { role: "system", content: systemPrompt01 },
              ...messageList,
              { role: "user", content: `Generate UI components from these Yelp listings to respond to the user prompt: ${JSON.stringify(businesses.results)}. The original user prompt was: ${prompt}` }
            ];

            const productResponse = await openai.chat.completions.create({
              model: currentModel,
              messages: productMessageList,
              stream: true
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
                        if (item.type === "list-item" || item.type === "avatar") {
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
               
                if (item.type === "image" || item.type === "list-item" || item.type === "avatar") {
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

    logInteraction({
      type: "text",
      prompt,
      result: fullMessage,
      model: currentModel,
      ip: res.req.ip,
      id: sessionId
    });
    
    // Save full message to session store
    sessionMessages[sessionId + 1] = [
      { role: "user", content: prompt },
      { role: "assistant", content: fullMessage }
    ];

  } catch (error) {
    console.error("Streaming Error:", error.response?.status, error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate content." });
  }
// });
};

// Rate limit API calls
app.use("/api/generate", limiter);
app.use("/api/button-click", limiter);

// HEAD pre-check route for /api/generate (used for rate limit detection)
app.head("/api/generate", (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).end();
  }

  // Return only headers to allow client-side pre-checks
  res.status(200).end();
});

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
  const { content, ID } = req.body;
  console.log("Button click attempted with content:", JSON.stringify(content), "and ID:", ID);

  if (!content || typeof content === 'object') {
    console.log("Rejected button click due to invalid content type");
    return res.status(400).json({ error: "Invalid button content" });
  }

  console.log("Button clicked with content:", content);

  try {
    const buttonPrompt = content + " with ID: " + ID + ". Generate a new UI based on this button click.";
    await generateContent(buttonPrompt, res);

    logInteraction({
      type: "button",
      prompt: buttonPrompt,
      result: "", // Or save response if needed
      model: currentModel,
      ip: req.ip,
      id: ID
    });

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

app.post("/api/comment", (req, res) => {
  const { comment } = req.body;

  if (!comment || comment.trim() === "") {
    return res.status(400).json({ error: "Comment is required" });
  }

  logInteraction({
    timestamp: new Date().toISOString(),
    type: "comment",
    prompt: comment,
    result: "",
    model: "",
    ip: req.ip,
    id: "comment"
  });

  sendEmailNotification(comment, req.ip);

  res.status(200).json({ success: true });
});

// Updated port configuration for Railway
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('PORT environment variable:', process.env.PORT);
});

// Logging webpage – only available in local development
  app.get("/logs", (req, res) => {
    const content = fs.readFileSync(logFilePath, "utf8");
    const lines = content.trim().split('\n');

    const entries = lines.reverse().map((line, index) => {
      try {
        const entry = JSON.parse(line);
        let resultFormatted;
        try {
          resultFormatted = JSON.stringify(JSON.parse(entry.result), null, 2);
        } catch {
          resultFormatted = entry.result || "(No result)";
        }
        return `
          <div class="entry">
            <p><strong>${new Date(entry.timestamp).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}</strong> | <code>${entry.type}</code> | <code>${entry.model}</code> | IP: ${entry.ip}</p>
            <p><strong>${entry.type === "comment" ? "Comment" : "Prompt"}:</strong> ${entry.prompt}</p>
            ${entry.type !== "comment" ? `
              <details>
                <summary><strong>Result (click to expand)</strong></summary>
                <pre>${resultFormatted}</pre>
              </details>
            ` : ""}
          </div>
          <hr />
        `;
      } catch (e) {
        return `<p>Error parsing line ${index + 1}</p>`;
      }
    }).join('\n');

    res.send(`
      <html>
        <head>
          <title>Interaction Logs</title>
          <style>
            body {
              font-family: sans-serif;
              padding: 20px;
              background: #f9f9f9;
            }
            .entry {
              margin-bottom: 24px;
            }
            pre {
              background: #eee;
              padding: 10px;
              border-radius: 6px;
              overflow-x: auto;
            }
            summary {
              cursor: pointer;
              font-weight: bold;
            }
            code {
              background: #e1e1e1;
              padding: 2px 4px;
              border-radius: 3px;
            }
          </style>
        </head>
        <body>
          <h1>Interaction Logs</h1>
          ${entries}
        </body>
      </html>
    `);
  });