import https from "https";
import dotenv from 'dotenv';

dotenv.config();

const username = process.env.OXYLABS_USERNAME;
const password = process.env.OXYLABS_PASSWORD;

export async function getAmazonProducts(search) {
    console.log("Fetching Amazon products:", search);
    
    if (!search) {
        throw new Error("Search query is required");
    }

    const body = {
        source: "amazon_search",
        query: search,
        geo_location: "90210",
        parse: true,
        context: [
            {
                key: "priority",
                value: "HIGH"
            },
            {
                key: "type",
                value: "SEARCH"
            }
        ],
        start_page: 1,
        pages: 1,
        limit: 10
    };

    const options = {
        hostname: "realtime.oxylabs.io",
        path: "/v1/queries",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
        },
    };

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let data = "";
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => {
                try {
                    if (!data) {
                        reject(new Error("Empty response from API"));
                        return;
                    }
                    const responseData = JSON.parse(data);
                    if (responseData.error || responseData.message) {
                        reject(new Error(responseData.error || responseData.message));
                        return;
                    }
                    
                    // Extract and limit organic results
                    if (responseData.results && 
                        responseData.results[0] && 
                        responseData.results[0].content && 
                        responseData.results[0].content.results && 
                        responseData.results[0].content.results.organic) {
                        
                        const organicResults = responseData.results[0].content.results.organic.slice(0, 10);
                        resolve({ results: organicResults });
                    } else {
                        reject(new Error("No organic results found"));
                    }
                } catch (error) {
                    console.error("Error parsing response:", error);
                    reject(error);
                }
            });
        });

        request.on("error", (error) => {
            reject(error);
        });

        request.write(JSON.stringify(body));
        request.end();
    });
}