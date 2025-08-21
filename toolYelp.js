import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';

export async function getYelpBusinesses(query, location = 'Seattle, WA') {
  console.log("🔍 Fetching Yelp data for:", query, "in", location);

  try {
    const response = await axios.get(YELP_BASE_URL, {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`
      },
      params: {
        term: query,
        location,
        limit: 6,
        sort_by: 'rating'
      }
    });

    const items = response.data.businesses.map((biz, index) => ({
      type: "list-item",
      props: {
        ID: `${1000 + index}`,
        content: `${biz.name}\n${biz.location.address1}\nRating: ${biz.rating}`,
        imageSrc: biz.image_url,
        columns: "4"
      }
    })).flat();

    return { results: items };
  } catch (err) {
    console.error("❌ Yelp API error:", err.response?.data || err.message);
    throw err;
  }
}