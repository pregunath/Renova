const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: 'access' }, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn });
}
function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn });
}
function verify(token) {
  return jwt.verify(token, config.jwt.secret);
}
module.exports = { signAccessToken, signRefreshToken, verify };
