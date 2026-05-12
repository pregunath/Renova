const jwt = require('jsonwebtoken');
const config = require('../config/env');

module.exports = function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.type !== 'access') return res.status(401).json({ message: 'Invalid token type' });

    req.userId = payload.sub;
    req.userRole = payload.role || 'user';
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
