const prisma = require('../lib/prisma');
const { uploadBuffer, getPresignedDownloadUrl } = require('../lib/s3');
const { removeBackground } = require('../lib/fal');

function extractKeyFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    return u.pathname.replace(/^\/+/, '');
  } catch {
    return null;
  }
}

function toInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error('Invalid id');
  return n;
}

// GET /api/moodboard/public
async function listPublicBoards(req, res) {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Number(req.query.offset) || 0;

    const boards = await prisma.moodboard.findMany({
      where: { isPublic: true },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      select: { id: true, title: true, thumbnailUrl: true, updatedAt: true },
    });

    const shaped = boards.map((b) => ({
      ...b,
      thumbnailUrl: b.thumbnailUrl
        ? `/api/media/moodboard/${b.id}/thumbnail`
        : null,
    }));

    return res.json({
      boards: shaped,
      pagination: { skip, take },
    });
  } catch (err) {
    console.error('listPublicBoards error', err);
    return res.status(500).json({
      message: 'Failed to list public moodboards',
    });
  }
}

// GET /api/moodboards/last?limit=1
async function getLastMoodboards(req, res) {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 1;

    const moodboards = await prisma.moodboard.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        updatedAt: true,
      },
    });

    return res.json({ moodboards });
  } catch (err) {
    console.error('getLastMoodboards error', err);
    return res.status(500).json({ error: 'Failed to fetch moodboards' });
  }
}

// GET /api/moodboard/:id
async function getBoardById(req, res) {
  try {
    const id = toInt(req.params.id);
    const board = await prisma.moodboard.findFirst({
      where: { id, userId: req.userId },
    });
    if (!board) return res.status(404).json({ error: 'Not found' });

    const response = {
      ...board,
      thumbnailUrl: board.thumbnailUrl
        ? `/api/media/moodboard/${board.id}/thumbnail`
        : null,
    };
    return res.json(response);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Bad request' });
  }
}

// GET /api/moodboard
async function listUserBoards(req, res) {
  try {
    const boards = await prisma.moodboard.findMany({
      where: { userId: req.userId },
      select: { id: true, title: true, thumbnailUrl: true, updatedAt: true }, 
      orderBy: { updatedAt: 'desc' },
    });

    const response = boards.map((b) => ({
      ...b,
      thumbnailUrl: b.thumbnailUrl
        ? `/api/media/moodboard/${b.id}/thumbnail`
        : null,
    }));
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list moodboards' });
  }
}

// POST /api/moodboard
// body: { title, scene, width, height, background?, isPublic? }
// files: thumbnail (multipart)
async function createBoard(req, res) {
  try {
    const { title, scene, width, height, background, isPublic } = req.body || {};
    if (!(await enforceMoodboardLimit(req, res))) return;

    if (!title || scene == null) {
      return res.status(400).json({ error: 'title and scene are required' });
    }

    const w = typeof width === 'string' ? Number.parseInt(width, 10) : width;
    const h = typeof height === 'string' ? Number.parseInt(height, 10) : height;

    if (!Number.isInteger(w) || !Number.isInteger(h)) {
      return res.status(400).json({ error: 'width and height must be integers' });
    }

    let isPublicValue;
    if (isPublic !== undefined) {
      if (typeof isPublic === 'string') {
        isPublicValue = isPublic === 'true';
      } else {
        isPublicValue = !!isPublic;
      }
    }

    const thumbFile = req.files?.thumbnail?.[0];

    let thumbnailUrlToSave = null;
    if (thumbFile && thumbFile.buffer) {
      const { url } = await uploadBuffer({
        buffer: thumbFile.buffer,
        contentType: thumbFile.mimetype,
        keyPrefix: `thumbnails/${req.userId}`,
      });
      thumbnailUrlToSave = url;
    }

    const board = await prisma.moodboard.create({
      data: {
        title,
        scene,
        width: w,
        height: h,
        background: background ?? null,
        thumbnailUrl: thumbnailUrlToSave,
        isPublic: isPublicValue,
        user: { connect: { id: req.userId } },
      },
    });

    const response = {
      ...board,
      thumbnailUrl: board.thumbnailUrl
        ? `/api/media/moodboard/${board.id}/thumbnail`
        : null,
    };

    return res.status(201).json(response);
  } catch (err) {
    console.error('createBoard error', err);
    return res.status(500).json({ error: 'Failed to create moodboard' });
  }
}

// POST /moodboards/:id/items
// auth: required
// files: file (multipart: field="file")
async function uploadMoodboardItemImage(req, res) {
  try {
    const id = toInt(req.params.id);

    const board = await prisma.moodboard.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!board) {
      return res.status(404).json({ error: 'Moodboard not found' });
    }

    if (board.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { url, key } = await uploadBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      keyPrefix: `moodboards/${board.id}/items`,
    });

    return res.status(201).json({
      src: url,
      key,
    });
  } catch (err) {
    console.error('uploadMoodboardItemImage error', err);
    return res.status(500).json({ error: 'Failed to upload moodboard item image' });
  }
}

// PATCH /api/moodboard/:id
// body: subset of { title, scene, width, height, background, isPublic }
// files: thumbnail (multipart)
async function updateBoardById(req, res) {
  try {
    const id = toInt(req.params.id);
    const board = await prisma.moodboard.findUnique({ where: { id } });
    if (!board) return res.status(404).json({ error: 'Not found' });
    if (board.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const { title, scene, width, height, background, isPublic } = req.body || {};

    const data = {};
    if (title !== undefined) data.title = title;
    if (scene !== undefined) data.scene = scene;
    if (width !== undefined) {
      const w = typeof width === 'string' ? Number.parseInt(width, 10) : width;
      if (!Number.isInteger(w)) return res.status(400).json({ error: 'width must be integer' });
      data.width = w;
    }
    if (height !== undefined) {
      const h = typeof height === 'string' ? Number.parseInt(height, 10) : height;
      if (!Number.isInteger(h)) return res.status(400).json({ error: 'height must be integer' });
      data.height = h;
    }
    if (background !== undefined) data.background = background;
    
    if (isPublic !== undefined) {
      if (typeof isPublic === 'string') {
        data.isPublic = isPublic === 'true';
      } else {
        data.isPublic = !!isPublic;
      }
    }

    const thumbFile = req.files?.thumbnail?.[0];

    if (thumbFile && thumbFile.buffer) {
      const { url } = await uploadBuffer({
        buffer: thumbFile.buffer,
        contentType: thumbFile.mimetype,
        keyPrefix: `thumbnails/${req.userId}`,
      });
      data.thumbnailUrl = url;
    }

    const updated = await prisma.moodboard.update({ where: { id }, data });

    const response = {
      ...updated,
      thumbnailUrl: updated.thumbnailUrl
        ? `/api/media/moodboard/${updated.id}/thumbnail`
        : null,
    };

    return res.json(response);
  } catch (err) {
    console.error('updateBoardById error', err);
    return res.status(500).json({ error: 'Failed to update moodboard' });
  }
}

// PATCH /api/moodboard/:id/visibility
async function toggleBoardVisibility(req, res) {
  try {
    const boardId = toInt(req.params.id);

    const board = await prisma.moodboard.findFirst({
      where: { id: boardId, userId: req.userId },
      select: { id: true, isPublic: true },
    });

    if (!board) {
      return res.status(404).json({ message: 'Moodboard not found' });
    }

    const newValue = !board.isPublic;

    const updated = await prisma.moodboard.update({
      where: { id: boardId },
      data: { isPublic: newValue },
    });

    return res.status(200).json({ board: updated });
  } catch (err) {
    console.error('toggleBoardVisibility error', err);
    return res.status(500).json({ message: 'Failed to update visibility' });
  }
}

// DELETE /api/moodboard/:id
async function deleteBoardById(req, res) {
  try {
    const id = toInt(req.params.id);
    const board = await prisma.moodboard.findUnique({ where: { id } });
    if (!board) return res.status(404).json({ error: 'Not found' });
    if (board.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.moodboard.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete moodboard' });
  }
}

async function enforceMoodboardLimit(req, res) {
  try {
    const userId = req.userId;

    //role + extra slots
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, moodboardsExtraSlots: true },
    });

    //Admin bypass
    if (userRow?.role === "admin") return true;

    // Require inside function to avoid touching top imports
    const stripe = require("../lib/stripe");
    const { getOrCreateStripeCustomer } = require("../lib/stripeCustomer");

    const customer = await getOrCreateStripeCustomer(userId);

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });

    const sub =
      subs.data.find((s) =>
        ["active", "trialing", "past_due", "unpaid"].includes(s.status)
      ) ||
      subs.data[0] ||
      null;

    let planRow;
    if (!sub) {
      planRow = await prisma.plan.findUnique({ where: { key: "free" } });
    } else {
      const priceId = sub.items?.data?.[0]?.price?.id;
      planRow =
        (priceId ? await prisma.plan.findFirst({ where: { priceId } }) : null) ||
        (await prisma.plan.findUnique({ where: { key: "free" } }));
    }

    const limits = planRow?.limits || {};
    const baseLimit = Number(limits.moodboards ?? limits.storageGB ?? 0);

    const extraSlots = Number(userRow?.moodboardsExtraSlots ?? 0);
    const effectiveLimit = baseLimit + extraSlots;

    // If limit is 0 or missing then unlimited
    if (!(effectiveLimit > 0)) return true;

    const moodboardsUsed = await prisma.moodboard.count({ where: { userId } });

    if (moodboardsUsed >= effectiveLimit) {
      res.status(403).json({
        code: "MOODBOARD_LIMIT_REACHED",
        message: `Moodboard limit reached (${moodboardsUsed}/${effectiveLimit}). Upgrade or buy add-ons.`,
        moodboardsUsed,
        moodboardsLimit: effectiveLimit,
        moodboardsBaseLimit: baseLimit,
        moodboardsExtraSlots: extraSlots,
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error("enforceMoodboardLimit error", err);
    res.status(500).json({ message: "Could not validate moodboard limit" });
    return false;
  }
}

async function cloneMoodboard(req, res) {
  try {
    if (!(await enforceMoodboardLimit(req, res))) return;

    const userId = req.userId;
    const sourceId = toInt(req.params.id);

    const source = await prisma.moodboard.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return res.status(404).json({ message: "Moodboard not found" });
    }

    if (!source.isPublic) {
      return res.status(403).json({ message: "Moodboard is not public" });
    }

    const cloned = await prisma.moodboard.create({
      data: {
        userId,
        title: `Copy of ${source.title}`,
        scene: source.scene, 
        width: source.width,
        height: source.height,
        background: source.background,
        thumbnailUrl: source.thumbnailUrl,
        isPublic: false,
        isPreset: false,
      },
    });

    return res.status(201).json({ id: cloned.id });

  } catch (error) {
    console.error("Clone moodboard error:", error);
    return res.status(500).json({ message: "Failed to clone moodboard" });
  }
}

// POST /api/moodboard/:id/remove-bg
// body: { src: string } — full S3 URL of the item image
async function removeBgForItem(req, res) {
  try {
    const id = toInt(req.params.id);
    const { src } = req.body;

    if (!src || typeof src !== 'string') {
      return res.status(400).json({ error: 'src is required' });
    }

    const board = await prisma.moodboard.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!board) return res.status(404).json({ error: 'Moodboard not found' });
    if (board.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const key = extractKeyFromUrl(src);
    if (!key) return res.status(400).json({ error: 'Invalid src URL' });

    const presignedUrl = await getPresignedDownloadUrl(key);
    const { imageUrl: falOutputUrl } = await removeBackground({ imageUrl: presignedUrl });

    const fetchRes = await fetch(falOutputUrl);
    if (!fetchRes.ok) throw new Error('Failed to download birefnet output');
    const buffer = Buffer.from(await fetchRes.arrayBuffer());

    const { url: newSrc } = await uploadBuffer({
      buffer,
      contentType: 'image/png',
      keyPrefix: `moodboards/${id}/items`,
    });

    return res.json({ src: newSrc });
  } catch (err) {
    console.error('[removeBgForItem]', err);
    return res.status(500).json({ error: err.message || 'Failed to remove background' });
  }
}

// GET /api/moodboard/presets
async function listPresets(req, res) {
  try {
    const boards = await prisma.moodboard.findMany({
      where: { isPreset: true, isPublic: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, thumbnailUrl: true },
    });

    const shaped = boards.map((b) => ({
      ...b,
      thumbnailUrl: b.thumbnailUrl
        ? `/api/media/moodboard/${b.id}/thumbnail`
        : null,
    }));

    return res.json({ boards: shaped });
  } catch (err) {
    console.error('listPresets error', err);
    return res.status(500).json({ message: 'Failed to fetch presets' });
  }
}


module.exports = {
  listPublicBoards,
  getLastMoodboards,
  getBoardById,
  listUserBoards,
  createBoard,
  uploadMoodboardItemImage,
  updateBoardById,
  toggleBoardVisibility,
  deleteBoardById,
  enforceMoodboardLimit,
  cloneMoodboard,
  removeBgForItem,
  listPresets,
};