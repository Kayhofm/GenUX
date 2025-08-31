import { generateImage } from './imageCreator.js';
import { logInteraction } from './logService.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { needsImageTypes } from './imageTypes.js';
import { getYelpBusinesses } from './toolYelp.js';

// Define Yelp tool for Claude
const yelpTool = {
    name: "get_yelp_businesses",
    description: "Search for businesses on Yelp by query and location. Use this when users ask for restaurants, bars, shops, services, or any local businesses.",
    input_schema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search term for businesses (e.g., 'pizza', 'coffee shops', 'hair salon')"
            },
            location: {
                type: "string",
                description: "The location to search in (e.g., 'Seattle, WA', 'New York, NY')",
                default: "Seattle, WA"
            }
        },
        required: ["query"]
    }
};

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

        // First, get the initial response to check for tool use
        const response = await anthropic.messages.create({
            model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: messageList,
            tools: [yelpTool],
        });

        console.log("🟢 Claude response received");
        
        // Check if Claude wants to use tools
        let toolResults = [];
        let hasTools = false;

        for (const content of response.content) {
            if (content.type === 'tool_use') {
                hasTools = true;
                console.log("🛠️ Tool call detected:", content.name, content.input);

                if (content.name === 'get_yelp_businesses') {
                    try {
                        // Send loading message
                        res.write(`data: ${JSON.stringify({
                            type: "text",
                            props: {
                                content: "🔍 Searching Yelp for local businesses...",
                                ID: "loading-yelp",
                                columns: "6"
                            }
                        })}\n\n`);

                        // Execute Yelp search
                        const yelpResult = await getYelpBusinesses(
                            content.input.query, 
                            content.input.location || "Seattle, WA"
                        );

                        console.log("✅ Yelp results:", yelpResult.results.length, "businesses found");

                        // Remove loading message
                        res.write(`data: ${JSON.stringify({
                            type: "remove",
                            props: { ID: "loading-yelp" }
                        })}\n\n`);

                        // Store tool result
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: content.id,
                            content: JSON.stringify(yelpResult.results)
                        });

                    } catch (toolError) {
                        console.error("❌ Yelp tool error:", toolError.message);
                        
                        // Remove loading and show error
                        res.write(`data: ${JSON.stringify({
                            type: "remove", 
                            props: { ID: "loading-yelp" }
                        })}\n\n`);

                        res.write(`data: ${JSON.stringify({
                            type: "text",
                            props: {
                                content: "Sorry, I couldn't search Yelp right now. Please try again later.",
                                ID: "yelp-error",
                                columns: "6"
                            }
                        })}\n\n`);

                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: content.id,
                            content: "Yelp search failed"
                        });
                    }
                }
            }
        }

        // If tools were used, make a follow-up request with tool results
        if (hasTools && toolResults.length > 0) {
            const followUpMessages = [
                ...messageList,
                {
                    role: "assistant",
                    content: response.content
                },
                {
                    role: "user", 
                    content: toolResults
                }
            ];

            // Stream the follow-up response
            const followUpStream = await anthropic.messages.stream({
                model,
                max_tokens: 2048,
                system: systemPrompt,
                messages: followUpMessages,
                tools: [yelpTool],
            });

            await processStream(followUpStream, res, imgIDRef);

        } else {
            // No tools used, stream the original response
            if (response.content[0]?.text) {
                await processTextContent(response.content[0].text, res, imgIDRef);
            }
        }

        res.write("data: [DONE]\n\n");
        res.end();

        // Log interaction
        logInteraction?.({
            type: "text",
            prompt,
            result: response.content[0]?.text || "Tool response",
            model,
            ip: res.req.ip,
            id: sessionId
        });

    } catch (error) {
        console.error("Claude Streaming Error:", error.message);

        if (!res.headersSent) {
            try {
                res.write(`data: ${JSON.stringify({ type: "error", message: "Claude overloaded" })}\n\n`);
                res.end();
            } catch (writeErr) {
                console.warn("⚠️ Tried to write error to closed response:", writeErr.message);
            }
        }
    }
}

// Helper function to process streaming responses
async function processStream(stream, res, imgIDRef) {
    let buffer = "";
    
    for await (const message of stream) {
        const delta = message.delta?.text;
        
        if (delta) {
            buffer += delta;
            
            // Try to parse and send complete JSON objects
            let tempBuffer = buffer;
            if (tempBuffer.startsWith("[")) tempBuffer = tempBuffer.slice(1);
            if (tempBuffer.endsWith("]")) tempBuffer = tempBuffer.slice(0, -1);
            if (tempBuffer.endsWith(",")) tempBuffer = tempBuffer.slice(0, -1);
            tempBuffer = `[${tempBuffer}]`;

            try {
                const parsed = JSON.parse(tempBuffer);
                if (Array.isArray(parsed)) {
                    await processComponents(parsed, res, imgIDRef);
                    buffer = "";
                }
            } catch (err) {
                // Incomplete JSON, keep accumulating
            }
        }
    }
}

// Helper function to process text content
async function processTextContent(text, res, imgIDRef) {
    try {
        // Try to parse as JSON array of components
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            await processComponents(parsed, res, imgIDRef);
        }
    } catch (err) {
        // If not JSON, send as plain text
        res.write(`data: ${JSON.stringify({
            type: "text",
            props: {
                content: text,
                ID: Date.now().toString(),
                columns: "6"
            }
        })}\n\n`);
    }
}

// Helper function to process UI components
async function processComponents(components, res, imgIDRef) {
    components.forEach(item => {
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
}