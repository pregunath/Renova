const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { getPresignedDownloadUrl } = require('../lib/s3');
const { Readable } = require('stream');

const router = express.Router();

// check if a given URL is an S3 URL from correct bucket.
function isAllowedMoodboardSrcHost(urlString) {
  try {
    const u = new URL(urlString);
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || "us-east-2";

    if (!bucket) return false;

    const allowedHosts = new Set([
      `${bucket}.s3.${region}.amazonaws.com`,
      `${bucket}.s3.amazonaws.com`,
    ]);

    return allowedHosts.has(u.hostname);
  } catch {
    return false;
  }
}

// extract the S3 object key from a full S3 URL.
function extractKeyFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    return u.pathname.replace(/^\/+/, '');
  } catch (err) {
    console.error('media: failed to parse S3 URL', urlString, err);
    return null;
  }
}

// take a stored S3 URL, generate a presigned URL and redirect the client to it.
async function proxyS3Url(res, s3Url) {
  if (!s3Url) {
    return res.status(404).json({ message: 'Image not found' });
  }

  const key = extractKeyFromUrl(s3Url);
  if (!key) {
    return res.status(500).json({ message: 'Invalid stored image URL' });
  }

  try {
    const signedUrl = await getPresignedDownloadUrl(key);
    const upstream = await fetch(signedUrl);

    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({ message: 'Failed to load image' });
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';

    const cacheControl =
      upstream.headers.get('cache-control') || 'public, max-age=300';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('media: getPresignedDownloadUrl error', err);
    return res.status(500).json({ message: 'Failed to load image' });
  }
}

/**
 * GET /api/media/me/avatar
 * Current user's avatar image.
 */
router.get('/me/avatar', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { avatarUrl: true },
    });

    if (!user || !user.avatarUrl) {
      return res.status(404).json({ message: 'Avatar not found' });
    }

    return proxyS3Url(res, user.avatarUrl);
  } catch (err) {
    console.error('media: /me/avatar error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

/**
 * GET /api/media/me/background
 * Current user's background image.
 */
router.get('/me/background', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { bgImageUrl: true },
    });

    if (!user || !user.bgImageUrl) {
      return res.status(404).json({ message: 'Background not found' });
    }

    return proxyS3Url(res, user.bgImageUrl);
  } catch (err) {
    console.error('media: /me/background error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

/**
 * GET /api/media/moodboard/:id/thumbnail
 * Thumbnail for a moodboard by id.
 */
router.get('/moodboard/:id/thumbnail', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid moodboard id' });
  }

  try {
    const board = await prisma.moodboard.findUnique({
      where: { id },
      select: { thumbnailUrl: true },
    });

    if (!board) {
      return res.status(404).json({ message: 'Moodboard not found' });
    }

    if (!board.thumbnailUrl) {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }

    return proxyS3Url(res, board.thumbnailUrl);
  } catch (err) {
    console.error('media: /moodboard/:id/thumbnail error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

/**
 * GET /api/media/moodboard/:id/item-by-src
 * Image items for a moodboard by id.
 * Also allows serving items from preset/public source boards
 * ( when a user clones a preset, items still live under the original board's S3 prefix).
 */
router.get('/moodboard/:id/item-by-src', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const { src } = req.query || {};

  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid moodboard id' });
  }

  if (!src || typeof src !== 'string' || !src.trim()) {
    return res.status(400).json({ message: 'src is required' });
  }

  try {
    const board = await prisma.moodboard.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!board) {
      return res.status(404).json({ message: 'Moodboard not found' });
    }

    const trimmedSrc = src.trim();

    if (!isAllowedMoodboardSrcHost(trimmedSrc)) {
      return res.status(400).json({ message: 'Invalid src host' });
    }

    const key = extractKeyFromUrl(trimmedSrc);
    if (!key) {
      return res.status(400).json({ message: 'Invalid src' });
    }

    // Check if src belongs to this board directly
    const ownPrefix = `moodboards/${board.id}/items/`;
    if (key.startsWith(ownPrefix)) {
      return proxyS3Url(res, trimmedSrc);
    }

    // src belongs to a different board — only allow if that board is public/preset
    // Extract the source board id from the S3 key: "moodboards/<id>/items/..."
    const match = key.match(/^moodboards\/(\d+)\/items\//);
    if (!match) {
      return res.status(403).json({ message: 'This src does not belong to this moodboard' });
    }

    const sourceBoardId = Number.parseInt(match[1], 10);
    const sourceBoard = await prisma.moodboard.findUnique({
      where: { id: sourceBoardId },
      select: { isPublic: true, isPreset: true },
    });

    // Allow if source board is a preset or public board
    if (sourceBoard && (sourceBoard.isPreset || sourceBoard.isPublic)) {
      return proxyS3Url(res, trimmedSrc);
    }

    return res.status(403).json({ message: 'This src does not belong to this moodboard' });

  } catch (err) {
    console.error('media: /moodboard/:id/item-by-src error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

/**
 * GET /api/media/generation/:id
 * Generated image for a Generation by id.
 */
router.get('/generation/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid generation id' });
  }

  try {
    const generation = await prisma.generation.findUnique({
      where: { id },
      select: {
        imageUrl: true,
      },
    });

    if (!generation) {
      return res.status(404).json({ message: 'Generation not found' });
    }

    if (!generation.imageUrl) {
      return res.status(404).json({ message: 'Image not found' });
    }

    return proxyS3Url(res, generation.imageUrl);
  } catch (err) {
    console.error('media: /generation/:id error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

module.exports = router;
