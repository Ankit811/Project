import { rateLimit } from 'express-rate-limit';

const createLoginLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests
    message: {
        message: 'Too many login attempts from this IP, please try again after 15 minutes',
    },
    standardHeaders: 'draft-7', // uses modern format
    legacyHeaders: false, //diable leagacy format
    keyGenerator: (req) => {
        // Use the IP address as the key for rate limiting
        return req.ip;
    },
    skip: (req) => {
        // Skip rate limiting for non-login routes
        return !req.path.startsWith('/api/auth/login');
    },
});

export  {createLoginLimiter};