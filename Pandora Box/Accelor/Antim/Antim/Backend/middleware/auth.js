import {verifyToken as verify} from '../utils/sauth/jwt_token.js';

const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'No Authorization header provided' });
  }

  else if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Invalid Authorization header format. Expected "Bearer <token>"' });
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided in Authorization header' });
  }
  console.log('Extracted token:', token);
  console.log('Token length:', token.length);
  
  try {
    const decoded = verify(token);
    if (!decoded.id) {
      return res.status(403).json({ message: 'Invalid token: JWT payload missing id field' });
    }
    req.user = {
      ...decoded,
      role: decoded.loginType, // Map loginType to role for role middleware
    };
    // console.log('Decoded user:', req.user); // For debugging
    next();
  } catch (err) {
    let message = 'Invalid token';
    if (err.name === 'TokenExpiredError') {
      message = 'Token expired';
    } else if (err.name === 'JsonWebTokenError') {
      message = `Invalid token: ${err.message}`;
    }
    return res.status(403).json({ message });
  }
};

export  {auth};