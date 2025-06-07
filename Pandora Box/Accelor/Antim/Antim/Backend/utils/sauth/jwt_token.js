// ✅ Correct ES6 import for CommonJS modules
import jwt from 'jsonwebtoken';
const { sign, verify } = jwt;

const generateToken = (payload, expiresIn = '100h') => {

  return sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  console.log('Verifying JWT token:', token);
  const d =    verify(token, process.env.JWT_SECRET);
  console.log('Decoded JWT token:', d);
  return d
};

export  { generateToken, verifyToken };
