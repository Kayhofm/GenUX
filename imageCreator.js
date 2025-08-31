
import EventEmitter from "events";
import { fal } from "@fal-ai/client";
import { OpenAI } from "openai";

// Array to store generated image URLs
const imageStore = [];
const imageEventEmitter = new EventEmitter(); // Event emitter to notify new images

/**
 * Generate an image based on the provided prompt
 * @param {string} prompt - The text prompt to generate the image
 * @returns {Promise<string>} - The generated image URL
 */
const generateImage = async (imgID, columns, prompt) => {
  try {

    const widths = {
      "2": 140,  //translate columns to pixels
      "3": 220,
      "6": 460,
    };
    const width = widths[columns] || 220; // Default to 220px if no match
    
    const result = await fal.subscribe("fal-ai/fast-lightning-sdxl", {
      input: {
        prompt: prompt + "Make the image a hyper-realistic photo.",
        image_size: "square_hd"
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });
    // console.log("result.data: ", result.data);
    // console.log("result.requestId: ", result.requestId);

    const imageUrl = result.data.images[0].url; // Extract the generated image URL
    imageStore[imgID] = imageUrl; // Save the image URL at the position specified by imgID

    // Emit an event to notify listeners
    imageEventEmitter.emit("newImage", imageUrl, imgID);

    return imageUrl;
  } catch (error) {
    console.error("Error generating image:", error.message);
    throw new Error("Failed to generate image");
  }
};

const generateImageDalle = async (imgID, columns, prompt) => {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1, // Number of images to generate
      size: "1024x1024", // Image resolution
    });

    const imageUrl = response.data[0].url; // Extract the generated image URL
    imageStore[imgID] = imageUrl; // Save the image URL at the position specified by imgID

    // Emit an event to notify listeners
    imageEventEmitter.emit("newImage", imageUrl, imgID);

    console.log("✅ Image URL:", imageUrl, typeof imageUrl);

    // return imageUrl;
    return typeof imageUrl === "string" ? imageUrl : "/img/default-image.png";
  } catch (error) {
    console.error("Error generating image:", error.message);
    throw new Error("Failed to generate image");
  }
};

/**
 * Get all stored image URLs
 * @returns {string[]} - Array of image URLs
 */
const getImageStore = () => {
  return imageStore;
};

export { generateImage, generateImageDalle, getImageStore, imageEventEmitter };
