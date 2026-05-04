const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'realm-of-echoes-fallback-secret';

/**
 * Socket.IO authentication middleware
 * Verifies JWT from handshake auth and attaches user to socket
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    return next(new Error('Invalid or expired token'));
  }
}

module.exports = socketAuthMiddleware;
