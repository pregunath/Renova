const prisma = require('../lib/prisma');
const { uploadBuffer, getPresignedDownloadUrl } = require('../lib/s3');
const { generateImage, DEFAULT_EDIT_MODEL, isSupportedEditModel } = require('../lib/fal');

function toInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error('Invalid id');
  return n;
}

// GET /api/generation/public
async function listPublicGenerations(req, res) {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Number(req.query.offset) || 0;

    const generations = await prisma.generation.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const shaped = generations.map((g) => ({
      ...g,
      imageUrl: g.imageUrl ? `/api/media/generation/${g.id}` : null,
    }));

    return res.json({
      generations: shaped,
      pagination: { skip, take },
    });
  } catch (err) {
    console.error('listPublicGenerations error', err);
    return res.status(500).json({ message: 'Failed to list public generations' });
  }
}

// GET /api/generation
async function listUserGenerations(req, res) {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Number(req.query.offset) || 0;

    const generations = await prisma.generation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const shaped = generations.map((g) => ({
      ...g,
      imageUrl: g.imageUrl ? `/api/media/generation/${g.id}` : null,
    }));

    return res.json({
      generations: shaped,
      pagination: { skip, take },
    });
  } catch (err) {
    console.error('listUserGenerations error', err);
    return res.status(500).json({ message: 'Failed to list generations' });
  }
}

// GET /api/generation/board/:moodboardId
async function listUserGenerationsForBoard(req, res) {
  try {
    const moodboardId = toInt(req.params.moodboardId);

    const generations = await prisma.generation.findMany({
      where: {
        userId: req.userId,
        moodboardId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const shaped = generations.map((g) => ({
      ...g,
      imageUrl: g.imageUrl ? `/api/media/generation/${g.id}` : null,
    }));

    return res.json({ generations: shaped });
  } catch (err) {
    if (err.message === 'Invalid id') {
      return res.status(400).json({ message: 'Invalid moodboardId' });
    }
    console.error('listUserGenerationsForBoard error', err);
    return res.status(500).json({ message: 'Failed to list board generations' });
  }
}

// POST /api/generation
// body: { prompt?, moodboardId?, isPublic?, modelKey? }
// files: { baseImage?: [file], inputItems?: [file, file, ...] }
async function createGeneration(req, res) {
  if (!(await enforceGenerationLimit(req, res))) return;

  try {
    const { prompt, moodboardId, isPublic, modelKey } = req.body || {};

    const requestedModelKey = typeof modelKey === 'string' && modelKey.trim() ? modelKey.trim() : DEFAULT_EDIT_MODEL;

    if (!isSupportedEditModel(requestedModelKey)) {
      return res.status(400).json({ message: 'Unsupported modelKey' });
    }

    let moodboardIdInt = null;
    if (moodboardId !== undefined && moodboardId !== null && moodboardId !== '') {
      try {
        moodboardIdInt = toInt(moodboardId);
      } catch {
        return res.status(400).json({ message: 'Invalid moodboardId' });
      }

      // ensure the moodboard belongs to the current user
      const board = await prisma.moodboard.findFirst({
        where: { id: moodboardIdInt, userId: req.userId },
        select: { id: true },
      });

      if (!board) {
        return res.status(404).json({ message: 'Moodboard not found' });
      }
    }

    const files = req.files || {};
    const baseFile = Array.isArray(files.baseImage) ? files.baseImage[0] : null;
    const itemFiles = Array.isArray(files.inputItems) ? files.inputItems : [];

    if (itemFiles.length === 0) {
      return res.status(400).json({
        message: 'You must select at least one item to generate.',
      });
    }

    // upload baseImage to S3
    let baseImageS3Url = null;
    let baseImageKey = null;

    if (baseFile && baseFile.buffer) {
      const { key, url } = await uploadBuffer({
        buffer: baseFile.buffer,
        contentType: baseFile.mimetype,
        keyPrefix: `generations/base/${req.userId}`,
      });
      baseImageS3Url = url;
      baseImageKey = key;
    }

    // upload inputItems to S3
    const inputUrls = [];
    const inputKeys = [];

    for (const file of itemFiles) {
      if (!file || !file.buffer) continue;

      const { key, url } = await uploadBuffer({
        buffer: file.buffer,
        contentType: file.mimetype,
        keyPrefix: `generations/items/${req.userId}`,
      });

      inputUrls.push(url);
      inputKeys.push(key);
    }

    const imageUrls = [];

    if (baseImageKey) {
      const signedBase = await getPresignedDownloadUrl(baseImageKey);
      imageUrls.push(signedBase);
    }

    for (const key of inputKeys) {
      const signed = await getPresignedDownloadUrl(key);
      imageUrls.push(signed);
    }

    if (imageUrls.length === 0) {
      return res.status(400).json({
        message: 'Failed to prepare reference images for generation',
      });
    }

    const {
      imageUrl: generatedImageUrl,
      modelKey: resolvedModelKey,
    } = await generateImage({
      userPrompt: prompt,
      imageUrls,
      modelKey: requestedModelKey,
    });

    const response = await fetch(generatedImageUrl);
    if (!response.ok) {
      console.error('Failed to download generated image', generatedImageUrl, response.status);
      return res.status(502).json({ message: 'Failed to download generated image' });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { url: finalImageS3Url } = await uploadBuffer({
      buffer,
      contentType,
      keyPrefix: `generations/${req.userId}`,
    });

    const generation = await prisma.generation.create({
      data: {
        userId: req.userId,
        moodboardId: moodboardIdInt,
        imageUrl: finalImageS3Url,
        prompt: typeof prompt === 'string' ? prompt : '',
        baseImageUrl: baseImageS3Url,
        inputItems: inputUrls.length ? inputUrls : null,
        modelKey: resolvedModelKey,
        isPublic: typeof isPublic === 'boolean' ? isPublic : undefined,
      },
    });

    if (req._bankedGenConsumed) req._bankedGenConsumed = false;

    const shaped = {
      ...generation,
      imageUrl: generation.imageUrl
        ? `/api/media/generation/${generation.id}`
        : null,
    };

    return res.status(201).json({ generation: shaped });
  } catch (err) {
    if (req._bankedGenConsumed) {
      try {
        await prisma.user.update({
          where: { id: req.userId },
          data: { bankedGenerationsRemaining: { increment: 1 } },
        });
      } catch (e) {
        console.error("Failed to refund banked generation credit", e);
      }
    }

    console.error('createGeneration error', err);
    return res.status(500).json({ message: 'Failed to create generation' });
  }
}

// DELETE /api/generation/:id
async function deleteGeneration(req, res) {
  try {
    const id = toInt(req.params.id);

    const generation = await prisma.generation.findUnique({
      where: { id },
    });

    if (!generation) {
      return res.status(404).json({ message: 'Generation not found' });
    }

    if (generation.userId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.generation.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'Invalid id') {
      return res.status(400).json({ message: 'Invalid id' });
    }
    console.error('deleteGeneration error', err);
    return res.status(500).json({ message: 'Failed to delete generation' });
  }
}

// PATCH /api/generation/:id/visibility
async function toggleGenerationVisibility(req, res) {
  try {
    const genId = toInt(req.params.id);

    const generation = await prisma.generation.findFirst({
      where: { id: genId, userId: req.userId },
      select: { id: true, isPublic: true }
    });

    if (!generation) {
      return res.status(404).json({ message: "Generation not found" });
    }

    const newValue = !generation.isPublic;

    const updated = await prisma.generation.update({
      where: { id: genId },
      data: { isPublic: newValue }
    });

    return res.status(200).json({ generation: updated });
  } catch (err) {
    console.error("toggleGenerationVisibility error", err);
    return res.status(500).json({ message: "Failed to update visibility" });
  }
}

// GET /api/generation/admin/all
async function listAllGenerations(req, res) {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Number(req.query.offset) || 0;

    const generations = await prisma.generation.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return res.json({
      generations,
      pagination: { skip, take },
    });
  } catch (err) {
    console.error('listAllGenerations error', err);
    return res.status(500).json({ message: 'Failed to list all generations' });
  }
}

// PATCH /api/generation/admin/:id
async function updateGenerationById(req, res) {
  try {
    const id = toInt(req.params.id);
    const { isPublic, prompt, baseImageUrl, inputItems, moodboardId, modelKey } = req.body || {};

    const data = {};

    if (typeof isPublic === 'boolean') {
      data.isPublic = isPublic;
    } 
    else if (typeof isPublic === 'string') {
      if (isPublic === 'true') data.isPublic = true;
      if (isPublic === 'false') data.isPublic = false;
    }

    if (typeof prompt === 'string') {
      data.prompt = prompt;
    }

    if (baseImageUrl !== undefined) {
      data.baseImageUrl = typeof baseImageUrl === 'string' ? baseImageUrl : null;
    }

    if (inputItems !== undefined) {
      if (Array.isArray(inputItems)) {
        data.inputItems = inputItems;
      } else {
        data.inputItems = null;
      }
    }

    if (moodboardId !== undefined) {
      if (moodboardId === null || moodboardId === '') {
        data.moodboardId = null;
      } else {
        try {
          data.moodboardId = toInt(moodboardId);
        } catch {
          return res.status(400).json({ message: 'Invalid moodboardId' });
        }
      }
    }

    if (modelKey !== undefined) {
      if (modelKey === null || modelKey === '') {
        data.modelKey = null;
      } else if (!isSupportedEditModel(modelKey)) {
        return res.status(400).json({ message: 'Unsupported modelKey' });
      } else {
        data.modelKey = modelKey;
      }
    }

    const updated = await prisma.generation.update({
      where: { id },
      data,
    });

    return res.json({ generation: updated });
  } catch (err) {
    if (err.message === 'Invalid id') {
      return res.status(400).json({ message: 'Invalid id' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Generation not found' });
    }
    console.error('updateGenerationById error', err);
    return res.status(500).json({ message: 'Failed to update generation' });
  }
}

// DELETE /api/generation/admin/:id
async function adminDeleteGenerationById(req, res) {
  try {
    const id = toInt(req.params.id);

    await prisma.generation.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'Invalid id') {
      return res.status(400).json({ message: 'Invalid id' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Generation not found' });
    }
    console.error('adminDeleteGenerationById error', err);
    return res.status(500).json({ message: 'Failed to delete generation' });
  }
}

// PATCH /api/generation/attach-to-board
// body: { moodboardId, generationIds: number[] }
async function attachGenerationsToBoard(req, res) {
  try {
    const { moodboardId, generationIds } = req.body || {};

    if (!moodboardId || !Array.isArray(generationIds) || generationIds.length === 0) {
      return res
        .status(400)
        .json({ message: 'moodboardId and generationIds are required' });
    }

    let moodboardIdInt;
    try {
      moodboardIdInt = toInt(moodboardId);
    } catch {
      return res.status(400).json({ message: 'Invalid moodboardId' });
    }

    const board = await prisma.moodboard.findFirst({
      where: { id: moodboardIdInt, userId: req.userId },
      select: { id: true },
    });
    if (!board) {
      return res.status(404).json({ message: 'Moodboard not found' });
    }

    const ids = [];
    for (const raw of generationIds) {
      try {
        ids.push(toInt(raw));
      } catch {
        return res.status(400).json({ message: 'Invalid generationIds' });
      }
    }

    const result = await prisma.generation.updateMany({
      where: {
        id: { in: ids },
        userId: req.userId,
        moodboardId: null,
      },
      data: { moodboardId: moodboardIdInt },
    });

    return res.status(200).json({ updatedCount: result.count });
  } catch (err) {
    console.error('attachGenerationsToBoard error', err);
    return res
      .status(500)
      .json({ message: 'Failed to attach generations to board' });
  }
}

async function enforceGenerationLimit(req, res) {
  try {
    const userId = req.userId;

    const prisma = require("../lib/prisma");
    const stripe = require("../lib/stripe");
    const { getOrCreateStripeCustomer } = require("../lib/stripeCustomer");

    //Admin bypass unlimited generations
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (u?.role === "admin") {
      req._bankedGenConsumed = false;
      return true;
    }

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

    let planRow = null;
    let periodStart = null;
    let periodEnd = null;

    if (!sub) {
      planRow = await prisma.plan.findUnique({ where: { key: "free" } });
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
      const priceId = sub.items?.data?.[0]?.price?.id || null;

      planRow =
        (priceId ? await prisma.plan.findFirst({ where: { priceId } }) : null) ||
        (await prisma.plan.findUnique({ where: { key: "free" } }));

      periodStart = new Date(sub.current_period_start * 1000);
      periodEnd = new Date(sub.current_period_end * 1000);
    }

    const monthlyLimit = Number(planRow?.limits?.generations ?? 0);

    //monthly used in this billing window
    const monthlyUsed = await prisma.generation.count({
      where: {
        userId,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    });

    //monthly credits available to allow
    if (monthlyLimit > 0 && monthlyUsed < monthlyLimit) {
      return true;
    }

    // try banked add-on credits (atomic)
    const updated = await prisma.user.updateMany({
      where: { id: userId, bankedGenerationsRemaining: { gt: 0 } },
      data: { bankedGenerationsRemaining: { decrement: 1 } },
    });

    if (updated.count === 1) {
      // mark that we consumed banked credit 
      req._bankedGenConsumed = true;
      return true;
    }

    //No monthly and no banked then deny
    res.status(403).json({
      code: "GEN_LIMIT_REACHED",
      message: "You are out of generation credits. Buy an add-on or upgrade your plan.",
      usage: { generationsUsed: monthlyUsed, generationsLimit: monthlyLimit },
    });
    return false;
  } catch (err) {
    console.error("enforceGenerationLimit error", err);
    res.status(500).json({ message: "Could not validate generation limit" });
    return false;
  }
}

module.exports = {
  listPublicGenerations,
  listUserGenerations,
  listUserGenerationsForBoard,
  createGeneration,
  deleteGeneration,
  toggleGenerationVisibility,
  listAllGenerations,
  updateGenerationById,
  adminDeleteGenerationById,
  attachGenerationsToBoard,
  enforceGenerationLimit,
};