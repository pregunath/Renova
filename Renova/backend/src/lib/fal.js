const { fal } = require("@fal-ai/client");
const config = require("../config/env");

const FAL_KEY = config.fal.falKey;

if (!FAL_KEY) {
  console.warn("FAL_KEY is not set. AI API calls will fail without it.");
}

fal.config({
  credentials: FAL_KEY,
});

const BASE_PROMPT = `
  Ultra-realistic, structurally accurate image generation with precise geometry,
  clean edges, and physically consistent lighting. Maintain correct proportions,
  stable perspective, and coherent material behavior. Avoid distortions, warped
  shapes, duplicated elements, extra limbs, artifacts, or unnatural stretching.
  Focus on clarity, realism, and faithful reconstruction of the intended scene.
`;

const DEFAULT_EDIT_MODEL = "fal-ai/bytedance/seedream/v4/edit";

function buildPrompt(userPrompt) {
  const trimmedUser = (userPrompt || "").trim();

  if (!trimmedUser) {
    return BASE_PROMPT.trim();
  }

  return `
${trimmedUser}

Global guidance:
${BASE_PROMPT.trim()}
`.trim();
}

const SUPPORTED_EDIT_MODELS = {
  "fal-ai/bytedance/seedream/v4/edit": {
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      image_size: "auto_2K",
      num_images: numImages,
      max_images: 1,
      enable_safety_checker: true,
      enhance_prompt_mode: "standard",
    }),
  },

  "fal-ai/bytedance/seedream/v4.5/edit": {
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      image_size: "auto_2K",
      num_images: numImages,
      max_images: 1,
      enable_safety_checker: true,
    }),
  },

  "fal-ai/bytedance/seedream/v5/lite/edit": {
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      image_size: "auto_2K",
      num_images: numImages,
      max_images: 1,
      enable_safety_checker: true,
    }),
  },

  "fal-ai/nano-banana-2/edit": {
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      num_images: numImages,
      aspect_ratio: "auto",
      output_format: "png",
      safety_tolerance: "4",
      resolution: "2K",
      limit_generations: true,
    }),
  },

  "fal-ai/nano-banana-pro/edit": {
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      num_images: numImages,
      aspect_ratio: "auto",
      output_format: "png",
      safety_tolerance: "4",
      resolution: "2K",
      limit_generations: true,
    }),
  },
};

function isSupportedEditModel(modelKey) {
  return !!SUPPORTED_EDIT_MODELS[modelKey];
}

function resolveEditModel(modelKey) {
  if (!modelKey) return DEFAULT_EDIT_MODEL;
  if (!isSupportedEditModel(modelKey)) return DEFAULT_EDIT_MODEL;
  return modelKey;
}

async function generateImage({
  userPrompt,
  imageUrls,
  modelKey = DEFAULT_EDIT_MODEL,
  numImages = 1,
}) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("imageUrls must be a non-empty array of URLs");
  }

  const prompt = buildPrompt(userPrompt);
  const resolvedModelKey = resolveEditModel(modelKey);
  const input = SUPPORTED_EDIT_MODELS[resolvedModelKey].buildInput({
    prompt,
    imageUrls,
    numImages,
  });

  try {
    const result = await fal.subscribe(resolvedModelKey, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && Array.isArray(update.logs)) {
          update.logs.forEach((log) => {
            if (log && log.message) {
              console.log("[Fal]", log.message);
            }
          });
        }
      },
    });

    const { data, requestId } = result || {};
    const imageUrl = data?.images?.[0]?.url || null;

    if (!imageUrl) {
      console.error("[Fal] Unexpected response shape:", data);
      throw new Error("Fal response missing image URL");
    }

    return {
      imageUrl,
      requestId,
      raw: data,
      modelKey: resolvedModelKey,
    };
  } catch (err) {
    console.error("[Fal] model:", resolvedModelKey);
    console.error("[Fal] error status:", err.status);
    console.error("[Fal] error body:", JSON.stringify(err.body, null, 2));
    throw err;
  }
}

async function removeBackground({ imageUrl }) {
  if (!imageUrl) throw new Error("imageUrl is required");

  const result = await fal.subscribe("fal-ai/birefnet/v2", {
    input: {
      image_url: imageUrl,
      model: "General Use (Light)",
      output_format: "png",
      operating_resolution: "1024x1024",
    },
    logs: false,
  });

  const outputUrl = result?.data?.image?.url;
  if (!outputUrl) {
    console.error("[Fal/birefnet] Unexpected response:", result?.data);
    throw new Error("birefnet response missing image URL");
  }

  return { imageUrl: outputUrl, requestId: result?.requestId };
}

module.exports = {
  buildPrompt,
  generateImage,
  removeBackground,
  DEFAULT_EDIT_MODEL,
  SUPPORTED_EDIT_MODELS,
  isSupportedEditModel,
};