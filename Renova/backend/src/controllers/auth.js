const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signAccessToken, signRefreshToken, verify } = require('../lib/tokens');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config/env');

const googleClient = config.google?.clientId ? new OAuth2Client(config.google.clientId) : null;

// POST /api/auth/register  body: { email, password, name?, occupation? }
async function register(req, res) {
  try {
    const { email, password, name, occupation } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, occupation, role: 'user' },
      select: { id: true, email: true, name: true, occupation: true, role: true, createdAt: true },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
}

// POST /api/auth/login  body: { email, password }
async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const publicUser = { id: user.id, email: user.email, name: user.name, occupation: user.occupation, role: user.role, createdAt: user.createdAt };
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    return res.json({ user: publicUser, accessToken, refreshToken });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
}

// POST /api/auth/refresh  body: { refreshToken } 
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });

    const payload = verify(refreshToken);
    if (payload.type !== 'refresh') return res.status(401).json({ message: 'Invalid token type' });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

// POST /api/auth/google  body: { idToken } 
async function googleLogin(req, res) {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ message: 'idToken required' });
    if (!googleClient) return res.status(500).json({ message: 'Google client not configured' });

    const ticket = await googleClient.verifyIdToken({ idToken, audience: config.google.clientId });
    const g = ticket.getPayload(); 

    if (!g?.email || !g?.sub) return res.status(401).json({ message: 'Google token invalid' });

    // Link or create user by email; store permanent googleId
    const user = await prisma.user.upsert({
      where: { email: g.email },
      update: { name: g.name ?? undefined, googleId: g.sub },
      create: { email: g.email, name: g.name, googleId: g.sub, passwordHash: null, role: 'user' },
      select: { id: true, email: true, name: true, occupation: true, role: true, createdAt: true },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    return res.json({ user, accessToken, refreshToken });
  } catch (err) {
    console.error('google login error', err);
    return res.status(401).json({ message: 'Google token invalid' });
  }
}

// POST /api/auth/change-password  body: { current, next }
async function changePassword(req, res) {
  try {
    const { current, next } = req.body || {};

    if (!next || String(next).length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // If user already has a password, require and verify `current`
    if (user.passwordHash) {
      if (!current) {
        return res
          .status(400)
          .json({ message: "Current password required" });
      }

      const ok = await bcrypt.compare(current, user.passwordHash);
      if (!ok) {
        return res
          .status(401)
          .json({ message: "Invalid current password" });
      }
    }

    const passwordHash = await bcrypt.hash(next, 10);

    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash },
    });

    return res.status(204).end();
  } catch (err) {
    console.error("changePassword error", err);
    return res.status(500).json({ message: "Internal error" });
  }
}

module.exports = { register, login, refresh, googleLogin, changePassword };
