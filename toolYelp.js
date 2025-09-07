import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';

// Simple in-memory TTL cache for Yelp results to reduce repeated latency
// Keyed by `${query}::${location}` (lowercased). TTL default: 2 minutes.
const yelpCache = new Map();
const YELP_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const YELP_CACHE_MAX_ENTRIES = 100;

function cacheKey(query, location) {
  return `${String(query).trim().toLowerCase()}::${String(location).trim().toLowerCase()}`;
}

function getFromCache(key) {
  const entry = yelpCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    yelpCache.delete(key);
    return null;
  }
  return entry.value;
}

function setInCache(key, value) {
  // Basic size cap: evict oldest when exceeding max entries
  if (yelpCache.size >= YELP_CACHE_MAX_ENTRIES) {
    const firstKey = yelpCache.keys().next().value;
    if (firstKey) yelpCache.delete(firstKey);
  }
  yelpCache.set(key, { value, expiresAt: Date.now() + YELP_CACHE_TTL_MS });
}

export async function getYelpBusinesses(query, location = 'Seattle, WA') {
  const key = cacheKey(query, location);
  const cached = getFromCache(key);
  if (cached) {
    console.log("🔍 Yelp cache hit for:", query, "in", location);
    return cached;
  }

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
    const result = { results: items };
    setInCache(key, result);
    return result;
  } catch (err) {
    console.error("❌ Yelp API error:", err.response?.data || err.message);
    throw err;
  }
}
