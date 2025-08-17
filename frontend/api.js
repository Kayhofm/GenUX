// frontend/src/config/api.js
const API_CONFIG = {
  BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://genux-production.up.railway.app'
    : 'http://localhost:4000',
  
  ENDPOINTS: {
    GENERATE: '/api/generate',
    BUTTON_CLICK: '/api/button-click', 
    GENERATE_IMAGE: '/api/generate-image',
    IMAGES_STREAM: '/api/images/stream',
    IMAGES_GENERATE: '/api/images/generate',
    SET_MODEL: '/api/set-model'
  }
};

export default API_CONFIG;