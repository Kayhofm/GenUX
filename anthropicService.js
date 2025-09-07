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

        // console.log("🛠️ Available tools:", JSON.stringify([yelpTool], null, 2));

        // Start with streaming immediately
        const stream = await anthropic.messages.stream({
            model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: messageList,
            tools: [yelpTool],
        });

        console.log("🟢 Claude stream opened");

        let buffer = "";
        let fullMessage = "";
        let pendingToolUse = null;
        let toolInput = "";
        let sawToolUse = false; // Track whether the model initiated any tool_use
        let parseWarnedMain = false; // Log JSON parse gate once per request (main stream)
        const mainStats = { emitted: 0 }; // Count components dispatched in main stream
        imgIDRef.current = imgIDRef.current || 1000;

        for await (const message of stream) {
            // Handle tool use start
            if (message.type === "content_block_start" && message.content_block?.type === "tool_use") {
                sawToolUse = true;

                // Send loading message
                res.write(`data: ${JSON.stringify({
                    type: "text",
                    props: {
                        content: "🔍 Searching Yelp for local businesses...",
                        ID: "loading-yelp",
                        columns: "6"
                    }
                })}\n\n`);

                pendingToolUse = {
                    id: message.content_block.id,
                    name: message.content_block.name
                };
                toolInput = "";
                console.log("🛠️ Tool call starting:", pendingToolUse.name);
                
                continue;
            }

            // Accumulate tool input
            if (message.type === "content_block_delta" && message.delta?.type === "input_json_delta") {
                if (pendingToolUse) {
                    toolInput += message.delta.partial_json;
                }
                continue;
            }

            // Tool input complete, execute tool
            if (message.type === "content_block_stop" && pendingToolUse) {
                try {
                    const input = JSON.parse(toolInput);
                    console.log("🛠️ Tool call complete:", pendingToolUse.name, input);

                    if (pendingToolUse.name === "get_yelp_businesses") {

                        // Clear any content that was streamed before the tool call
                        console.log("🧹 Clearing previous content before tool results");
                        res.write(`data: ${JSON.stringify({
                            type: "clear"
                        })}\n\n`);
                         if (res.flush) res.flush();

                        try {
                            const yelpResult = await getYelpBusinesses(input.query, input.location);
                            console.log("✅ Yelp results:", yelpResult.results.length, "businesses found");

                            /* Remove loading message
                            res.write(`data: ${JSON.stringify({
                                type: "remove",
                                props: { ID: "loading-yelp" }
                            })}\n\n`);
                            if (res.flush) res.flush();
                            */
                           
                            // Continue with follow-up stream
                            const followUpMessages = [
                                ...messageList,
                                {
                                    role: "assistant",
                                    content: [
                                        { type: "text", text: "I'll search for businesses on Yelp." },
                                        { 
                                            type: "tool_use", 
                                            id: pendingToolUse.id, 
                                            name: pendingToolUse.name, 
                                            input: input 
                                        }
                                    ]
                                },
                                {
                                    role: "user",
                                    content: [
                                        {
                                            type: "tool_result",
                                            tool_use_id: pendingToolUse.id,
                                            content: `Generate UI components with these Yelp businesses: ${JSON.stringify(yelpResult.results)}`
                                            // content: `Current UI already shows: "${fullMessage}". Use that existing UI and don't send components to render it again. Now generate UI components with these Yelp businesses, replacing or updating the existing content appropriately: ${JSON.stringify(yelpResult.results)}`

                                        }
                                    ]
                                }
                            ];

                            // Start new stream for results
                            const followUpStream = await anthropic.messages.stream({
                                model,
                                max_tokens: 2048,
                                system: systemPrompt,
                                messages: followUpMessages,
                            });
                            console.log("🔁 Follow-up stream starting (Yelp results) for session:", sessionId);
                            // Process follow-up stream with stats for logging
                            const followUpStats = { emitted: 0 };
                            await processStream(followUpStream, res, imgIDRef, followUpStats);
                            console.log("🔁 Follow-up stream completed. Components dispatched:", followUpStats.emitted, "session:", sessionId);

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
                        }
                    }
                } catch (parseError) {
                    console.error("❌ Tool input parse error:", parseError.message);
                }

                pendingToolUse = null;
                toolInput = "";
                continue;
            }

            // Handle regular text streaming
            if (message.type === "content_block_delta" && message.delta?.type === "text_delta") {
                const delta = message.delta.text;
                
                if (delta) {
                    buffer += delta;
                    fullMessage += delta;

                    // Process streaming JSON as it comes in
                    let tempBuffer = buffer;
                    if (tempBuffer.startsWith("[")) tempBuffer = tempBuffer.slice(1);
                    if (tempBuffer.endsWith("]")) tempBuffer = tempBuffer.slice(0, -1);
                    if (tempBuffer.endsWith(",")) tempBuffer = tempBuffer.slice(0, -1);
                    tempBuffer = `[${tempBuffer}]`;

                    try {
                        const parsed = JSON.parse(tempBuffer);
                        if (Array.isArray(parsed)) {
                            processComponents(parsed, res, imgIDRef, mainStats);
                            buffer = ""; // Reset buffer after successful parse
                        }
                    } catch (err) {
                        if (!parseWarnedMain) {
                            console.warn("⏳ Main stream JSON not yet complete; accumulating… session:", sessionId);
                            parseWarnedMain = true;
                        }
                        // Incomplete JSON, keep accumulating
                    }
                }
            }
        }

        if (!sawToolUse) {
            console.log("ℹ️ No tool_use observed; main stream completed. Session:", sessionId, "components:", mainStats.emitted);
        }

        console.log("📤 Sending [DONE]. Session:", sessionId, "components:", mainStats.emitted, "tool_used:", sawToolUse);
        res.write("data: [DONE]\n\n");
        res.end();

        // Log interaction
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
                // Explicit log for overload path to aid diagnosis
                console.warn("🟥 Sending overload SSE error to client (Claude overloaded). Session:", sessionId);
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

// Helper function to process streaming responses
async function processStream(stream, res, imgIDRef) {
    let buffer = "";
    let parseWarnedFollowUp = false;
    
    for await (const message of stream) {
        if (message.type === "content_block_delta" && message.delta?.type === "text_delta") {
            const delta = message.delta.text;
            
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
                        // stats arg is optional for backwards-compat
                        processComponents(parsed, res, imgIDRef, arguments[3]);
                        buffer = "";
                    }
                } catch (err) {
                    if (!parseWarnedFollowUp) {
                        console.warn("⏳ Follow-up stream JSON not yet complete; accumulating…");
                        parseWarnedFollowUp = true;
                    }
                    // Incomplete JSON, keep accumulating
                }
            }
        }
    }
}

// Helper function to process UI components
function processComponents(components, res, imgIDRef, stats) {
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

        // Count for diagnostics
        if (stats && typeof stats.emitted === 'number') {
            stats.emitted += 1;
        }

        console.log("🧩 Dispatching component:", item.type, item.props?.ID || "no-id");
        res.write(`data: ${JSON.stringify(item)}\n\n`);
    });
}
