import { generateImage } from './imageCreator.js';
import { logInteraction } from './logService.js'; // Optional, if you've modularized it
import { Anthropic } from '@anthropic-ai/sdk';
import { needsImageTypes } from './imageTypes.js';

export async function streamClaudeResponse({
    model,
    prompt,
    userPrompt01,
    systemPrompt,
    messageList,
    sessionId,
    res,
    sessionMessages,
    imgIDRef,
}) {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

  try {
    console.log("🟣 Claude block triggered");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await anthropic.messages.stream({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: messageList,
    });

    console.log("🟢 Claude stream opened");

    let buffer = "";
    let fullMessage = "";
    imgIDRef.current = imgIDRef.current || 1000;

    for await (const message of stream) {

        // Handle tool use
        if (message.type === "tool_use") {
            console.log("🛠️ Tool call:", message.name, message.input);
            // call tool executor here
            // and then continue the loop with tool outputs
            continue;
        }

      const delta = message.delta?.text;

      if (delta) {
        buffer += delta;
        fullMessage += delta;

        // Clean up buffer to try parsing it as JSON
        let tempBuffer = buffer;
        if (tempBuffer.startsWith("[")) tempBuffer = tempBuffer.slice(1);
        if (tempBuffer.endsWith("]")) tempBuffer = tempBuffer.slice(0, -1);
        if (tempBuffer.endsWith(",")) tempBuffer = tempBuffer.slice(0, -1);
        tempBuffer = `[${tempBuffer}]`;

        try {
          const parsed = JSON.parse(tempBuffer);
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
                const needsImage = needsImageTypes.includes(item.type);
                const content = item.props?.content || "missing content";
                const columns = item.props?.columns || 6;

              if (needsImage && typeof content === "string" && content.trim() !== "") {
                try {
                  imgIDRef.current++;
                  const imageUrl = generateImage(imgIDRef.current, columns, content);
                  item.props.imageID = imgIDRef.current;
                  item.props.imageSrc = imageUrl || "/img/default-image.png";
                } catch (err) {
                  console.error("❌ Image error:", err.message);
                  item.props.imageSrc = "/img/default-image.png";
                }
              }

              res.write(`data: ${JSON.stringify(item)}\n\n`);
            });

            buffer = ""; // Reset buffer
          }
        } catch (err) {
          // Incomplete JSON, keep accumulating
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

    logInteraction?.({
      type: "text",
      prompt,
      result: fullMessage,
      model,
      ip: res.req.ip,
      id: sessionId
    });

    sessionMessages[sessionId + 1] = [
      { role: "user", content: userPrompt01 + prompt },
      { role: "assistant", content: fullMessage }
    ];

    } catch (error) {
        console.error("Claude Streaming Error:", error.message);

        if (!res.headersSent) {
            try {
            res.write(`data: ${JSON.stringify({ type: "error", message: "Claude overloaded" })}\n\n`);
            res.end();
            } catch (writeErr) {
            console.warn("⚠️ Tried to write error to closed response:", writeErr.message);
            }
        } else {
            console.warn("⚠️ Cannot send error, headers already sent.");
        }
    }
}