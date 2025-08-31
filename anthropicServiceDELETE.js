import { generateImage } from './imageCreator.js';
import { logInteraction } from './logService.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { needsImageTypes } from './imageTypes.js';
import { getYelpBusinesses } from './toolYelp.js';

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
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    console.log("🟣 Claude block triggered");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let buffer = "";
    let fullMessage = "";
    imgIDRef.current = imgIDRef.current || 1000;

    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messageList,
      tool_choice: "auto",
      tools: [
        {
          name: "get_yelp_businesses",
          description: "Searches Yelp for local businesses based on a query and location",
          input_schema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search term, e.g. 'sushi' or 'coffee'" },
              location: { type: "string", description: "Location, e.g. 'Seattle, WA'" }
            },
            required: ["query"]
          }
        }
      ]
    });

    for await (const message of stream) {
      if (message.type === "tool_use") {
        console.log("🛠️ Tool call:", message.name, message.input);
        const { query, location } = message.input;

        res.write(`data: ${JSON.stringify({
          type: "text",
          props: {
            content: "\n Retrieving data, please wait...",
            ID: "9999",
            columns: "6"
          }
        })}\n\n`);

        try {
          const { results } = await getYelpBusinesses(query, location);

          for (const item of results) {
            res.write(`data: ${JSON.stringify(item)}\n\n`);
          }

          res.write(`data: ${JSON.stringify({ type: "remove", props: { ID: "9999" } })}\n\n`);

          await stream.sendToolResult({
            tool_use_id: message.id,
            content: { results }
          });

          console.log("📨 Tool result sent — starting new stream for continuation...");

          const continuation = await anthropic.messages.stream({
            model,
            system: systemPrompt,
            messages: [
              ...messageList,
              { role: "user", content: userPrompt01 + prompt },
              { role: "tool", tool_use_id: message.id, content: { results } }
            ],
            max_tokens: 2048,
          });

          for await (const contMessage of continuation) {
            const delta = contMessage.delta?.text;
            if (delta) {
              buffer += delta;
              fullMessage += delta;

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
                  buffer = "";
                }
              } catch {}
            }

            if (
              contMessage.type === "message_delta" &&
              ["end", "end_turn", "tool_use"].includes(contMessage.delta?.stop_reason)
            ) {
              res.write("data: [DONE]\n\n");
              res.end();
            }
          }

          return;
        } catch (err) {
          console.error("❌ Tool call error:", err.message);
          res.write(`data: ${JSON.stringify({ type: "error", message: "Tool execution failed." })}\n\n`);
          res.end();
          return;
        }
      }

      const delta = message.delta?.text;
      if (delta) {
        buffer += delta;
        fullMessage += delta;

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
            buffer = "";
          }
        } catch {}
      }

      if (
        message.type === "message_delta" &&
        ["end", "end_turn", "tool_use"].includes(message.delta?.stop_reason)
      ) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }

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
