// Explicit factory so the hoisted mock is in place before fal.js calls fal.config()
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    subscribe: jest.fn(),
  },
}));

const { fal } = require('@fal-ai/client');
const {
  buildPrompt,
  generateImage,
  removeBackground,
  DEFAULT_EDIT_MODEL,
  SUPPORTED_EDIT_MODELS,
  isSupportedEditModel,
} = require('../../../lib/fal');

const BASE_PROMPT_FRAGMENT = 'Ultra-realistic';

describe('Fal Library', () => {
  describe('buildPrompt', () => {
    it('should return the base prompt when no user prompt is given', () => {
      const result = buildPrompt('');

      expect(result).toContain(BASE_PROMPT_FRAGMENT);
      expect(result.trim()).toBe(result);
    });

    it('should return the base prompt for undefined', () => {
      const result = buildPrompt(undefined);

      expect(result).toContain(BASE_PROMPT_FRAGMENT);
    });

    it('should return the base prompt for whitespace-only input', () => {
      const result = buildPrompt('   ');

      expect(result).toContain(BASE_PROMPT_FRAGMENT);
    });

    it('should include the user prompt when provided', () => {
      const result = buildPrompt('a cozy living room');

      expect(result).toContain('a cozy living room');
    });

    it('should include global guidance when user prompt is provided', () => {
      const result = buildPrompt('a cozy living room');

      expect(result).toContain('Global guidance:');
      expect(result).toContain(BASE_PROMPT_FRAGMENT);
    });

    it('should trim whitespace from the user prompt', () => {
      const result = buildPrompt('  modern kitchen  ');

      expect(result).toContain('modern kitchen');
    });

    it('should produce a trimmed string with no leading/trailing whitespace', () => {
      const result = buildPrompt('bedroom with plants');

      expect(result.trimStart()).toBe(result);
      expect(result.trimEnd()).toBe(result);
    });
  });

  describe('DEFAULT_EDIT_MODEL', () => {
    it('should be the seedream v4 edit model', () => {
      expect(DEFAULT_EDIT_MODEL).toBe('fal-ai/bytedance/seedream/v4/edit');
    });
  });

  describe('isSupportedEditModel', () => {
    it('should return true for the default model', () => {
      expect(isSupportedEditModel(DEFAULT_EDIT_MODEL)).toBe(true);
    });

    it('should return false for an unknown model', () => {
      expect(isSupportedEditModel('fal-ai/unknown/model')).toBe(false);
    });

    it('should return true for all keys in SUPPORTED_EDIT_MODELS', () => {
      for (const key of Object.keys(SUPPORTED_EDIT_MODELS)) {
        expect(isSupportedEditModel(key)).toBe(true);
      }
    });
  });

  describe('generateImage', () => {
    const validImageUrls = ['https://example.com/room.jpg', 'https://example.com/item.jpg'];

    const mockFalResult = {
      data: { images: [{ url: 'https://cdn.fal.ai/generated/image.jpg' }] },
      requestId: 'req_abc123',
    };

    beforeEach(() => {
      fal.subscribe.mockResolvedValue(mockFalResult);
    });

    it('should return imageUrl, requestId, raw, and modelKey', async () => {
      const result = await generateImage({
        userPrompt: 'modern living room',
        imageUrls: validImageUrls,
      });

      expect(result.imageUrl).toBe('https://cdn.fal.ai/generated/image.jpg');
      expect(result.requestId).toBe('req_abc123');
      expect(result.raw).toEqual(mockFalResult.data);
      expect(result.modelKey).toBe(DEFAULT_EDIT_MODEL);
    });

    it('should throw if imageUrls is empty', async () => {
      await expect(
        generateImage({ userPrompt: 'test', imageUrls: [] })
      ).rejects.toThrow('imageUrls must be a non-empty array of URLs');
    });

    it('should throw if imageUrls is not an array', async () => {
      await expect(
        generateImage({ userPrompt: 'test', imageUrls: 'not-an-array' })
      ).rejects.toThrow('imageUrls must be a non-empty array of URLs');
    });

    it('should call fal.subscribe with the correct model and input', async () => {
      await generateImage({
        userPrompt: 'cozy bedroom',
        imageUrls: validImageUrls,
      });

      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/bytedance/seedream/v4/edit',
        expect.objectContaining({
          input: expect.objectContaining({
            image_urls: validImageUrls,
            num_images: 1,
          }),
        })
      );
    });

    it('should use auto_2K as the default image size for the default model', async () => {
      await generateImage({ userPrompt: 'test', imageUrls: validImageUrls });

      expect(fal.subscribe).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({ image_size: 'auto_2K' }),
        })
      );
    });

    it('should use the specified modelKey when supported', async () => {
      await generateImage({
        userPrompt: 'test',
        imageUrls: validImageUrls,
        modelKey: 'fal-ai/bytedance/seedream/v4.5/edit',
      });

      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/bytedance/seedream/v4.5/edit',
        expect.any(Object)
      );
    });

    it('should fall back to DEFAULT_EDIT_MODEL when an unsupported modelKey is given', async () => {
      await generateImage({
        userPrompt: 'test',
        imageUrls: validImageUrls,
        modelKey: 'fal-ai/unknown/model',
      });

      expect(fal.subscribe).toHaveBeenCalledWith(
        DEFAULT_EDIT_MODEL,
        expect.any(Object)
      );
    });

    it('should forward a custom numImages', async () => {
      fal.subscribe.mockResolvedValue({
        data: {
          images: [
            { url: 'https://cdn.fal.ai/img1.jpg' },
            { url: 'https://cdn.fal.ai/img2.jpg' },
          ],
        },
        requestId: 'req_multi',
      });

      await generateImage({
        userPrompt: 'test',
        imageUrls: validImageUrls,
        numImages: 2,
      });

      expect(fal.subscribe).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({ num_images: 2 }),
        })
      );
    });

    it('should throw if the response is missing an image URL', async () => {
      fal.subscribe.mockResolvedValue({ data: { images: [] }, requestId: 'req_bad' });

      await expect(
        generateImage({ userPrompt: 'test', imageUrls: validImageUrls })
      ).rejects.toThrow('Fal response missing image URL');
    });

    it('should throw if fal.subscribe rejects', async () => {
      fal.subscribe.mockRejectedValue(new Error('Fal API error'));

      await expect(
        generateImage({ userPrompt: 'test', imageUrls: validImageUrls })
      ).rejects.toThrow('Fal API error');
    });

    it('should build and send the prompt via buildPrompt', async () => {
      await generateImage({ userPrompt: 'sunny kitchen', imageUrls: validImageUrls });

      const calledInput = fal.subscribe.mock.calls[0][1].input;
      expect(calledInput.prompt).toContain('sunny kitchen');
      expect(calledInput.prompt).toContain(BASE_PROMPT_FRAGMENT);
    });

    it('should invoke onQueueUpdate callback for IN_PROGRESS status with logs', async () => {
      fal.subscribe.mockImplementation(async (_modelKey, options) => {
        // Trigger the onQueueUpdate callback with IN_PROGRESS + logs
        options.onQueueUpdate({
          status: 'IN_PROGRESS',
          logs: [{ message: 'step 1' }, { message: 'step 2' }],
        });
        // Also trigger with a log entry that has no message (branch coverage)
        options.onQueueUpdate({
          status: 'IN_PROGRESS',
          logs: [null, { message: null }, { message: 'valid' }],
        });
        // Also trigger with a non-IN_PROGRESS status (should be a no-op)
        options.onQueueUpdate({ status: 'IN_QUEUE', logs: [] });
        return mockFalResult;
      });

      const result = await generateImage({ userPrompt: 'test', imageUrls: validImageUrls });

      expect(result.imageUrl).toBe(mockFalResult.data.images[0].url);
    });

    it('should use v4.5/edit model with correct input shape', async () => {
      await generateImage({
        userPrompt: 'modern kitchen',
        imageUrls: validImageUrls,
        modelKey: 'fal-ai/bytedance/seedream/v4.5/edit',
      });

      const calledInput = fal.subscribe.mock.calls[0][1].input;
      expect(calledInput).toMatchObject({
        image_urls: validImageUrls,
        image_size: 'auto_2K',
        num_images: 1,
        enable_safety_checker: true,
      });
      // v4.5/edit should NOT have enhance_prompt_mode
      expect(calledInput).not.toHaveProperty('enhance_prompt_mode');
    });

    it('should use v5/lite/edit model with correct input shape', async () => {
      await generateImage({
        userPrompt: 'living room',
        imageUrls: validImageUrls,
        modelKey: 'fal-ai/bytedance/seedream/v5/lite/edit',
      });

      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/bytedance/seedream/v5/lite/edit',
        expect.objectContaining({
          input: expect.objectContaining({
            image_urls: validImageUrls,
            image_size: 'auto_2K',
          }),
        })
      );
    });

    it('should use nano-banana-2/edit model with correct input shape', async () => {
      await generateImage({
        userPrompt: 'bathroom',
        imageUrls: validImageUrls,
        modelKey: 'fal-ai/nano-banana-2/edit',
      });

      const calledInput = fal.subscribe.mock.calls[0][1].input;
      expect(calledInput).toMatchObject({
        image_urls: validImageUrls,
        aspect_ratio: 'auto',
        output_format: 'png',
        safety_tolerance: '4',
        resolution: '2K',
        limit_generations: true,
      });
    });

    it('should use nano-banana-pro/edit model with correct input shape', async () => {
      await generateImage({
        userPrompt: 'office',
        imageUrls: validImageUrls,
        modelKey: 'fal-ai/nano-banana-pro/edit',
      });

      const calledInput = fal.subscribe.mock.calls[0][1].input;
      expect(calledInput).toMatchObject({
        image_urls: validImageUrls,
        aspect_ratio: 'auto',
        output_format: 'png',
        safety_tolerance: '4',
        resolution: '2K',
        limit_generations: true,
      });
    });
  });

  // ─── removeBackground ──────────────────────────────────────────────────────

  describe('removeBackground', () => {
    const mockBgResult = {
      data: { image: { url: 'https://cdn.fal.ai/removed-bg.png' } },
      requestId: 'req_bg_001',
    };

    beforeEach(() => {
      fal.subscribe.mockResolvedValue(mockBgResult);
    });

    it('should return imageUrl and requestId on success', async () => {
      const result = await removeBackground({ imageUrl: 'https://example.com/room.jpg' });

      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/birefnet/v2',
        expect.objectContaining({
          input: expect.objectContaining({
            image_url: 'https://example.com/room.jpg',
            model: 'General Use (Light)',
            output_format: 'png',
            operating_resolution: '1024x1024',
          }),
          logs: false,
        })
      );
      expect(result.imageUrl).toBe('https://cdn.fal.ai/removed-bg.png');
      expect(result.requestId).toBe('req_bg_001');
    });

    it('should throw if imageUrl is not provided', async () => {
      await expect(removeBackground({ imageUrl: null })).rejects.toThrow('imageUrl is required');
      await expect(removeBackground({})).rejects.toThrow('imageUrl is required');
    });

    it('should throw if the response is missing the output image URL', async () => {
      fal.subscribe.mockResolvedValue({ data: { image: null }, requestId: 'req_bg_bad' });

      await expect(
        removeBackground({ imageUrl: 'https://example.com/room.jpg' })
      ).rejects.toThrow('birefnet response missing image URL');
    });

    it('should throw if fal.subscribe rejects', async () => {
      fal.subscribe.mockRejectedValue(new Error('Network error'));

      await expect(
        removeBackground({ imageUrl: 'https://example.com/room.jpg' })
      ).rejects.toThrow('Network error');
    });
  });

  // ─── FAL_KEY warning (module init) ─────────────────────────────────────────

  describe('FAL_KEY warning', () => {
    it('should warn when FAL_KEY is not configured', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      jest.isolateModules(() => {
        // Override the env config to return no falKey
        jest.doMock('../../../config/env', () => ({
          fal: { falKey: undefined },
        }));
        // Re-require fal.js so the module init code runs again
        require('../../../lib/fal');
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('FAL_KEY is not set')
      );
      warnSpy.mockRestore();
    });
  });
});
