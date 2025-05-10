import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();
export const userAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.userId) {
      return res.json({ success: false, message: 'Not authorized, invalid token' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Error in user auth:', err.message);
    res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
  }
};