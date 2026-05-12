jest.mock('../../../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('bcryptjs');

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

// Must be set before auth.js loads so googleClient is initialized
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

const prisma = require('../../../lib/prisma');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { register, login, refresh, googleLogin, changePassword } = require('../../../controllers/auth');
const { generateTestRefreshToken } = require('../../helpers/mockJWT');
const { testUsers, testGooglePayload } = require('../../helpers/testData');

const publicUser = {
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  occupation: 'Designer',
  role: 'user',
  createdAt: testUsers.regularUser.createdAt,
};

let mockVerifyIdToken;

describe('Auth Controller', () => {
  let req, res;

  beforeAll(() => {
    mockVerifyIdToken = OAuth2Client.mock.results[0].value.verifyIdToken;
  });

  beforeEach(() => {
    req = { body: {}, userId: 1 };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    it('should return 400 if email is missing', async () => {
      req.body = { password: 'password123' };
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email and password are required' });
    });

    it('should return 400 if password is missing', async () => {
      req.body = { email: 'test@example.com' };
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 409 if email already exists', async () => {
      req.body = { email: 'existing@example.com', password: 'password123' };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email already in use' });
    });

    it('should create a user and return 201 with tokens', async () => {
      req.body = { email: 'new@example.com', password: 'password123', name: 'New User' };
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('$2a$10$hashed');
      prisma.user.create.mockResolvedValue(publicUser);

      await register(req, res);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@example.com', role: 'user' }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
    });

    it('should return 500 on unexpected error', async () => {
      req.body = { email: 'new@example.com', password: 'password123' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB down'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('login', () => {
    it('should return 400 if email is missing', async () => {
      req.body = { password: 'password123' };
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if password is missing', async () => {
      req.body = { email: 'test@example.com' };
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if user not found', async () => {
      req.body = { email: 'nobody@example.com', password: 'password123' };
      prisma.user.findUnique.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    it('should return 401 if user has no password hash (OAuth-only account)', async () => {
      req.body = { email: 'google@example.com', password: 'password123' };
      prisma.user.findUnique.mockResolvedValue({ ...testUsers.googleUser, passwordHash: null });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for wrong password', async () => {
      req.body = { email: 'user@example.com', password: 'wrongpass' };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);
      bcrypt.compare.mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with user and tokens on success', async () => {
      req.body = { email: 'user@example.com', password: 'correctpass' };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);
      bcrypt.compare.mockResolvedValue(true);

      await login(req, res);

      expect(res.status).not.toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.user.email).toBe('user@example.com');
    });

    it('should return 500 on unexpected error', async () => {
      req.body = { email: 'user@example.com', password: 'pass' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('refresh', () => {
    it('should return 400 if refreshToken is missing', async () => {
      req.body = {};
      await refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'refreshToken required' });
    });

    it('should return 401 for an invalid token', async () => {
      req.body = { refreshToken: 'not.a.valid.token' };
      await refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 if token type is not refresh', async () => {
      const { generateTestAccessToken } = require('../../helpers/mockJWT');
      req.body = { refreshToken: generateTestAccessToken({ sub: 1 }) };

      await refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token type' });
    });

    it('should return 401 if user no longer exists', async () => {
      req.body = { refreshToken: generateTestRefreshToken({ sub: 99 }) };
      prisma.user.findUnique.mockResolvedValue(null);

      await refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('should return a new accessToken on success', async () => {
      req.body = { refreshToken: generateTestRefreshToken({ sub: 1, role: 'user' }) };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

      await refresh(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: expect.any(String) })
      );
    });
  });

  describe('googleLogin', () => {
    const mockTicket = { getPayload: jest.fn() };

    beforeEach(() => {
      mockVerifyIdToken.mockResolvedValue(mockTicket);
      mockTicket.getPayload.mockReturnValue(testGooglePayload);
    });

    it('should return 400 if idToken is missing', async () => {
      req.body = {};
      await googleLogin(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'idToken required' });
    });

    it('should return 401 if payload has no email or sub', async () => {
      req.body = { idToken: 'some-token' };
      mockTicket.getPayload.mockReturnValue({ email: null, sub: null });

      await googleLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should upsert user and return tokens on success', async () => {
      req.body = { idToken: 'valid-google-token' };
      prisma.user.upsert.mockResolvedValue(publicUser);

      await googleLogin(req, res);

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: testGooglePayload.email },
        })
      );
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
    });

    it('should return 401 if verifyIdToken throws', async () => {
      req.body = { idToken: 'bad-token' };
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await googleLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('changePassword', () => {
    it('should return 400 if new password is too short', async () => {
      req.body = { next: 'short' };
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'New password must be at least 8 characters' });
    });

    it('should return 401 if user not found', async () => {
      req.body = { next: 'newpassword123' };
      prisma.user.findUnique.mockResolvedValue(null);

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if user has a password but current is missing', async () => {
      req.body = { next: 'newpassword123' };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Current password required' });
    });

    it('should return 401 for wrong current password', async () => {
      req.body = { current: 'wrongpass', next: 'newpassword123' };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);
      bcrypt.compare.mockResolvedValue(false);

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid current password' });
    });

    it('should update password and return 204 on success', async () => {
      req.body = { current: 'correctpass', next: 'newpassword123' };
      prisma.user.findUnique.mockResolvedValue(testUsers.regularUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('$2a$10$newhash');
      prisma.user.update.mockResolvedValue({});

      await changePassword(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: '$2a$10$newhash' } })
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('should allow password set with no current if user has no passwordHash', async () => {
      req.body = { next: 'newpassword123' };
      prisma.user.findUnique.mockResolvedValue(testUsers.googleUser); // passwordHash: null
      bcrypt.hash.mockResolvedValue('$2a$10$newhash');
      prisma.user.update.mockResolvedValue({});

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on unexpected error', async () => {
      req.body = { next: 'newpassword123' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
