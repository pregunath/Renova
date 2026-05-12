const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { uploadBuffer, getPresignedDownloadUrl } = require('../../../lib/s3');

describe('S3 Library', () => {
  let mockSend;

  beforeAll(() => {
    // mock.results[0].value is the object returned by the factory (not the `this` context)
    mockSend = S3Client.mock.results[0].value.send;
  });

  beforeEach(() => {
    mockSend.mockResolvedValue({});
    getSignedUrl.mockResolvedValue('https://test-bucket.s3.us-east-2.amazonaws.com/test-key?signed=true');
  });

  describe('uploadBuffer', () => {
    it('should return key and url on success', async () => {
      const result = await uploadBuffer({
        buffer: Buffer.from('test'),
        contentType: 'image/jpeg',
        keyPrefix: 'avatars/1',
      });

      expect(typeof result.key).toBe('string');
      expect(typeof result.url).toBe('string');
    });

    it('should prefix the key with keyPrefix', async () => {
      const result = await uploadBuffer({
        buffer: Buffer.from('test'),
        contentType: 'image/png',
        keyPrefix: 'moodboards/456',
      });

      expect(result.key).toMatch(/^moodboards\/456\//);
    });

    it('should strip trailing slash from keyPrefix', async () => {
      const result = await uploadBuffer({
        buffer: Buffer.from('test'),
        contentType: 'image/png',
        keyPrefix: 'avatars/123/',
      });

      expect(result.key).toMatch(/^avatars\/123\/[^/]+$/);
    });

    it('should generate a unique key each call', async () => {
      const opts = { buffer: Buffer.from('test'), contentType: 'image/png', keyPrefix: 'uploads' };

      const r1 = await uploadBuffer(opts);
      const r2 = await uploadBuffer(opts);

      expect(r1.key).not.toBe(r2.key);
    });

    it('should append a UUID to the key', async () => {
      const result = await uploadBuffer({
        buffer: Buffer.from('test'),
        contentType: 'image/jpeg',
        keyPrefix: 'uploads',
      });

      expect(result.key).toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should call PutObjectCommand with the right args', async () => {
      const buffer = Buffer.from('image data');
      const contentType = 'image/jpeg';

      await uploadBuffer({ buffer, contentType, keyPrefix: 'uploads' });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: buffer,
          ContentType: contentType,
          Key: expect.stringMatching(/^uploads\//),
        })
      );
    });

    it('should call s3.send once', async () => {
      await uploadBuffer({ buffer: Buffer.from('data'), contentType: 'image/jpeg', keyPrefix: 'test' });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should include the key in the returned url', async () => {
      const result = await uploadBuffer({
        buffer: Buffer.from('test'),
        contentType: 'image/jpeg',
        keyPrefix: 'avatars/1',
      });

      expect(result.url).toContain(result.key);
      expect(result.url).toMatch(/^https:\/\//);
    });

    it('should throw if s3.send fails', async () => {
      mockSend.mockRejectedValue(new Error('S3 upload failed'));

      await expect(
        uploadBuffer({ buffer: Buffer.from('test'), contentType: 'image/jpeg', keyPrefix: 'test' })
      ).rejects.toThrow('S3 upload failed');
    });

    it('should handle an empty buffer', async () => {
      const result = await uploadBuffer({
        buffer: Buffer.alloc(0),
        contentType: 'image/png',
        keyPrefix: 'empty',
      });

      expect(result.key).toBeDefined();
      expect(result.url).toBeDefined();
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should return a string url', async () => {
      const url = await getPresignedDownloadUrl('avatars/123/file.jpg');

      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });

    it('should call GetObjectCommand with the given key', async () => {
      const key = 'avatars/123/file.jpg';
      await getPresignedDownloadUrl(key);

      expect(GetObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ Key: key }));
    });

    it('should default expiresIn to 600 seconds', async () => {
      await getPresignedDownloadUrl('test/file.jpg');

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 600 })
      );
    });

    it('should forward a custom expiresIn', async () => {
      await getPresignedDownloadUrl('test/file.jpg', 3600);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 3600 })
      );
    });

    it('should return whatever getSignedUrl resolves with', async () => {
      const expected = 'https://bucket.s3.amazonaws.com/key?sig=abc';
      getSignedUrl.mockResolvedValue(expected);

      const result = await getPresignedDownloadUrl('test/key');

      expect(result).toBe(expected);
    });

    it('should throw if getSignedUrl fails', async () => {
      getSignedUrl.mockRejectedValue(new Error('signing failed'));

      await expect(getPresignedDownloadUrl('test/key')).rejects.toThrow('signing failed');
    });
  });
});
