jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../../lib/s3', () => ({
  uploadBuffer: jest.fn(),
}));

jest.mock('bcryptjs');

const prisma = require('../../../lib/prisma');
const { uploadBuffer } = require('../../../lib/s3');
const bcrypt = require('bcryptjs');
const { getMe, updateMe, listUsers, getUserById, updateUserById, deleteUserById } = require('../../../controllers/user');
const { testUsers } = require('../../helpers/testData');

const publicUser = {
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  occupation: 'Designer',
  role: 'user',
  createdAt: testUsers.regularUser.createdAt,
  avatarUrl: null,
  bgImageUrl: null,
};

describe('User Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { userId: 1, body: {}, params: {}, query: {}, files: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
  });

  describe('getMe', () => {
    it('should return 404 if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await getMe(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return the user object on success', async () => {
      prisma.user.findUnique.mockResolvedValue(publicUser);
      await getMe(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.any(Object) })
      );
    });

    it('should map avatarUrl to the media proxy path', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...publicUser,
        avatarUrl: 'https://s3.amazonaws.com/bucket/avatar.jpg',
      });
      await getMe(req, res);
      const { user } = res.json.mock.calls[0][0];
      expect(user.avatarUrl).toBe('/api/media/me/avatar');
    });

    it('should return null for avatarUrl when not set', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...publicUser, avatarUrl: null });
      await getMe(req, res);
      const { user } = res.json.mock.calls[0][0];
      expect(user.avatarUrl).toBeNull();
    });

    it('should map bgImageUrl to the media proxy path', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...publicUser,
        bgImageUrl: 'https://s3.amazonaws.com/bucket/bg.jpg',
      });
      await getMe(req, res);
      const { user } = res.json.mock.calls[0][0];
      expect(user.bgImageUrl).toBe('/api/media/me/background');
    });
  });

  describe('updateMe', () => {
    it('should update name and occupation from body', async () => {
      req.body = { name: 'Updated Name', occupation: 'Engineer' };
      prisma.user.update.mockResolvedValue({ ...publicUser, name: 'Updated Name' });

      await updateMe(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Updated Name', occupation: 'Engineer' }) })
      );
    });

    it('should upload avatar to S3 when provided', async () => {
      req.files = { avatar: [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }] };
      uploadBuffer.mockResolvedValue({ key: 'avatars/1/uuid', url: 'https://bucket.s3.amazonaws.com/avatars/1/uuid' });
      prisma.user.update.mockResolvedValue({ ...publicUser, avatarUrl: 'https://bucket.s3.amazonaws.com/avatars/1/uuid' });

      await updateMe(req, res);

      expect(uploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ keyPrefix: 'avatars/1' })
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ avatarUrl: expect.any(String) }) })
      );
    });

    it('should upload bgImage to S3 when provided', async () => {
      req.files = { bgImage: [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }] };
      uploadBuffer.mockResolvedValue({ key: 'backgrounds/1/uuid', url: 'https://bucket.s3.amazonaws.com/bg' });
      prisma.user.update.mockResolvedValue({ ...publicUser, bgImageUrl: 'https://bucket.s3.amazonaws.com/bg' });

      await updateMe(req, res);

      expect(uploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ keyPrefix: 'backgrounds/1' })
      );
    });

    it('should return 500 on error', async () => {
      prisma.user.update.mockRejectedValue(new Error('DB error'));
      await updateMe(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listUsers', () => {
    it('should return a list of users with pagination info', async () => {
      prisma.user.findMany.mockResolvedValue([publicUser]);
      req.query = {};

      await listUsers(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ users: [publicUser], pagination: expect.any(Object) })
      );
    });

    it('should apply limit and offset from query', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      req.query = { limit: '10', offset: '20' };

      await listUsers(req, res);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      );
    });

    it('should cap limit at 100', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      req.query = { limit: '999' };

      await listUsers(req, res);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('getUserById', () => {
    it('should return 400 for a non-numeric id', async () => {
      req.params.id = 'abc';
      await getUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if user not found', async () => {
      req.params.id = '99';
      prisma.user.findUnique.mockResolvedValue(null);
      await getUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return the user on success', async () => {
      req.params.id = '1';
      prisma.user.findUnique.mockResolvedValue(publicUser);
      await getUserById(req, res);
      expect(res.json).toHaveBeenCalledWith({ user: publicUser });
    });
  });

  describe('updateUserById', () => {
    it('should return 400 for a non-numeric id', async () => {
      req.params.id = 'bad';
      await updateUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for Prisma P2025 (record not found)', async () => {
      req.params.id = '99';
      req.body = { name: 'Ghost' };
      const err = new Error('Not found');
      err.code = 'P2025';
      prisma.user.update.mockRejectedValue(err);

      await updateUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should hash password when provided', async () => {
      req.params.id = '1';
      req.body = { password: 'newpassword123' };
      bcrypt.hash.mockResolvedValue('$2a$10$newhash');
      prisma.user.update.mockResolvedValue(publicUser);

      await updateUserById(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ passwordHash: '$2a$10$newhash' }) })
      );
    });

    it('should not hash password if it is shorter than 8 characters', async () => {
      req.params.id = '1';
      req.body = { password: 'short' };
      prisma.user.update.mockResolvedValue(publicUser);

      await updateUserById(req, res);

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should return the updated user on success', async () => {
      req.params.id = '1';
      req.body = { name: 'New Name' };
      prisma.user.update.mockResolvedValue({ ...publicUser, name: 'New Name' });

      await updateUserById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.any(Object) })
      );
    });

    it('should return 500 on unexpected error', async () => {
      req.params.id = '1';
      prisma.user.update.mockRejectedValue(new Error('DB error'));

      await updateUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteUserById', () => {
    it('should return 400 for a non-numeric id', async () => {
      req.params.id = 'abc';
      await deleteUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if delete fails (user not found)', async () => {
      req.params.id = '99';
      prisma.user.delete.mockRejectedValue(new Error('Not found'));
      await deleteUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 204 on successful delete', async () => {
      req.params.id = '1';
      prisma.user.delete.mockResolvedValue({});
      await deleteUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });
});
