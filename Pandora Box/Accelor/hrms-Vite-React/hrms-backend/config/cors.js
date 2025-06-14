const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

// Validate and normalize origins
const validateOrigin = (origin) => {
  if (!origin) return true;
  
  // Normalize origin
  const normalizedOrigin = origin.trim().toLowerCase();
  
  try {
    // Handle mobile app origins
    if (normalizedOrigin.startsWith('app://') || 
        normalizedOrigin.startsWith('ionic://') || 
        normalizedOrigin.startsWith('capacitor://') ||
        normalizedOrigin.startsWith('file://')) {
      return true;
    }

    // Handle localhost and IP addresses
    if (normalizedOrigin === 'http://localhost' || 
        normalizedOrigin === 'https://localhost' ||
        normalizedOrigin.startsWith('http://127.0.0.1') ||
        normalizedOrigin.startsWith('https://127.0.0.1')) {
      return true;
    }

    // Handle standard web origins
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    // For mobile apps, we might not get a valid URL
    // Check if it's a valid IP address or localhost
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipRegex.test(normalizedOrigin)) {
      return true;
    }
    
    console.error(`Invalid origin format: ${origin}`);
    return false;
  }
};

// cors.js
const corsOptions = {
  origin: (origin, callback) => {
    try {
      if (!origin) {
        console.log('No origin provided');
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim();
      if (!validateOrigin(normalizedOrigin)) {
        console.error(`Rejected invalid origin: ${origin}`);
        return callback(new Error('Invalid origin format'));
      }

      if (allowedOrigins.includes(normalizedOrigin)) {
        console.log(`Allowed origin: ${origin}`);
        return callback(null, true);
      }

      console.error(`Rejected unauthorized origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    } catch (error) {
      console.error('CORS error:', error);
      return callback(error);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  maxAge: 86400, // 24 hours
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
};

export { allowedOrigins, corsOptions };