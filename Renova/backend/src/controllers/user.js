const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { uploadBuffer } = require('../lib/s3');

// Helpers
const publicSelect = {
  id: true,
  email: true,
  name: true,
  occupation: true,
  role: true,
  createdAt: true,
  avatarUrl: true,
  bgImageUrl: true,
};
const toInt = (v) => Number.parseInt(v, 10);

// Self
async function getMe(req, res) {
  const me = await prisma.user.findUnique({
    where: { id: req.userId },
    select: publicSelect,
  });
  if (!me) return res.status(404).json({ message: 'User not found' });

  const user = {
    ...me,
    avatarUrl: me.avatarUrl ? '/api/media/me/avatar' : null,
    bgImageUrl: me.bgImageUrl ? '/api/media/me/background' : null,
  };

  res.json({ user });
}

async function updateMe(req, res) {
  const { name, occupation, clearAvatar, clearBgImage } = req.body || {};   // NEW: added clearAvatar and Image so that the image for the profile can be cleared
  const data = {};
  
  if (typeof name === 'string') data.name = name;
  if (typeof occupation === 'string') data.occupation = occupation;

  // NEW ALSO: needed to add this for clearing the avatar and background image otherwise it stays added when trying to remove -EB
  const wantsClearAvatar = clearAvatar === "1" || clearAvatar === "true";
  const wantsClearBg = clearBgImage === "1" || clearBgImage === "true";

  if (wantsClearAvatar) data.avatarUrl = null;
  if (wantsClearBg) data.bgImageUrl = null;
 
  const files = req.files || {};
  const avatarFile = Array.isArray(files.avatar) ? files.avatar[0] : null;
  const bgFile = Array.isArray(files.bgImage) ? files.bgImage[0] : null;

  try {
    if (avatarFile && avatarFile.buffer) {
      const { url } = await uploadBuffer({
        buffer: avatarFile.buffer,
        contentType: avatarFile.mimetype,
        keyPrefix: `avatars/${req.userId}`,
      });
      data.avatarUrl = url;
    }

    if (bgFile && bgFile.buffer) {
      const { url } = await uploadBuffer({
        buffer: bgFile.buffer,
        contentType: bgFile.mimetype,
        keyPrefix: `backgrounds/${req.userId}`,
      });
      data.bgImageUrl = url;
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: publicSelect,
    });

    const user = {
      ...updated,
      avatarUrl: updated.avatarUrl ? '/api/media/me/avatar' : null,
      bgImageUrl: updated.bgImageUrl ? '/api/media/me/background' : null,
    };

    res.json({ user });
  } catch (err) {
    console.error('updateMe error', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

// Admin
async function listUsers(req, res) {
  const take = Math.min(Number(req.query.limit) || 50, 100);
  const skip = Number(req.query.offset) || 0;
  const users = await prisma.user.findMany({ skip, take, orderBy: { id: 'asc' }, select: publicSelect });
  res.json({ users, pagination: { skip, take } });
}

async function getUserById(req, res) {
  const id = toInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id' });

  const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}

async function updateUserById(req, res) {
  const id = toInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id' });

  const { name, occupation, role, password } = req.body || {};
  const data = {};

  if (typeof name === 'string') data.name = name;
  if (typeof occupation === 'string') data.occupation = occupation;
  if (typeof role === 'string') data.role = role;
  if (typeof password === 'string' && password.length >= 8) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const files = req.files || {};
  const avatarFile = Array.isArray(files.avatar) ? files.avatar[0] : null;
  const bgFile = Array.isArray(files.bgImage) ? files.bgImage[0] : null;

  try {
    if (avatarFile && avatarFile.buffer) {
      const { url } = await uploadBuffer({
        buffer: avatarFile.buffer,
        contentType: avatarFile.mimetype,
        keyPrefix: `avatars/${id}`,
      });
      data.avatarUrl = url;
    }

    if (bgFile && bgFile.buffer) {
      const { url } = await uploadBuffer({
        buffer: bgFile.buffer,
        contentType: bgFile.mimetype,
        keyPrefix: `backgrounds/${id}`,
      });
      data.bgImageUrl = url;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: publicSelect,
    });

    res.json({ user: updated });
  } catch (err) {
    console.error('updateUserById error', err);

    // Prisma "record not found" -> 404
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(500).json({ message: 'Internal error' });
  }
}

async function deleteUserById(req, res) {
  const id = toInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ message: 'User not found' });
  }
}

module.exports = {
  getMe,
  updateMe,
  listUsers,
  getUserById,
  updateUserById,
  deleteUserById,
};
