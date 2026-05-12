/**
 * Unit Tests for middleware/requireRole.js
 *
 * Tests role-based authorization middleware functionality.
 */

const requireRole = require('../../../middleware/requireRole');

describe('RequireRole Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('Single Role Authorization', () => {
    it('should allow user with matching role', () => {
      req.userRole = 'admin';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should allow regular user role', () => {
      req.userRole = 'user';
      const middleware = requireRole('user');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user without matching role', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when userRole is not set', () => {
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when userRole is null', () => {
      req.userRole = null;
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when userRole is undefined', () => {
      req.userRole = undefined;
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when userRole is empty string', () => {
      req.userRole = '';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Roles Authorization', () => {
    it('should allow when user has first allowed role', () => {
      req.userRole = 'admin';
      const middleware = requireRole('admin', 'moderator');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow when user has second allowed role', () => {
      req.userRole = 'moderator';
      const middleware = requireRole('admin', 'moderator');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow when user has any of multiple allowed roles', () => {
      req.userRole = 'editor';
      const middleware = requireRole('admin', 'moderator', 'editor', 'user');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when user role not in allowed list', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin', 'moderator');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle many allowed roles', () => {
      req.userRole = 'role5';
      const middleware = requireRole(
        'role1',
        'role2',
        'role3',
        'role4',
        'role5',
        'role6'
      );

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Middleware Factory Pattern', () => {
    it('should return a middleware function', () => {
      const middleware = requireRole('admin');

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should create independent middleware instances', () => {
      const adminMiddleware = requireRole('admin');
      const userMiddleware = requireRole('user');

      expect(adminMiddleware).not.toBe(userMiddleware);

      // Admin middleware allows admin
      req.userRole = 'admin';
      adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Reset
      jest.clearAllMocks();

      // Admin middleware rejects user
      req.userRole = 'user';
      adminMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();

      // Reset
      jest.clearAllMocks();

      // User middleware allows user
      req.userRole = 'user';
      userMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should preserve allowed roles in closure', () => {
      const middleware = requireRole('admin', 'moderator');

      // First call
      req.userRole = 'admin';
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Second call with different role
      req.userRole = 'moderator';
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Third call with unauthorized role
      req.userRole = 'user';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case-sensitive for role matching', () => {
      req.userRole = 'Admin';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should match exact case for roles', () => {
      req.userRole = 'admin';
      const middleware = requireRole('Admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should match exact case when role is uppercase', () => {
      req.userRole = 'ADMIN';
      const middleware = requireRole('ADMIN');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Special Role Names', () => {
    it('should handle role with hyphen', () => {
      req.userRole = 'super-admin';
      const middleware = requireRole('super-admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle role with underscore', () => {
      req.userRole = 'content_editor';
      const middleware = requireRole('content_editor');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle role with numbers', () => {
      req.userRole = 'admin2';
      const middleware = requireRole('admin2');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle role with dots', () => {
      req.userRole = 'role.name';
      const middleware = requireRole('role.name');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Responses', () => {
    it('should return 401 Unauthorized when no userRole', () => {
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should return 403 Forbidden when role not allowed', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should use correct HTTP status codes', () => {
      // 401 for missing authentication info
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);

      jest.clearAllMocks();

      // 403 for authenticated but unauthorized
      req.userRole = 'user';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Integration with Request Flow', () => {
    it('should work in middleware chain', () => {
      req.userRole = 'admin';
      const middleware = requireRole('admin');

      // Simulate previous middleware setting userRole
      const authMiddleware = (req, res, next) => {
        req.userRole = 'admin';
        next();
      };

      authMiddleware(req, res, () => {
        middleware(req, res, next);
      });

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should not call next() when unauthorized', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should stop middleware chain on authorization failure', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin');

      const nextHandler = jest.fn();
      middleware(req, res, nextHandler);

      expect(nextHandler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle no allowed roles specified', () => {
      req.userRole = 'admin';
      const middleware = requireRole();

      middleware(req, res, next);

      // No roles allowed means no one is authorized
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle empty array of roles via spread', () => {
      req.userRole = 'admin';
      const roles = [];
      const middleware = requireRole(...roles);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle duplicate roles in allowed list', () => {
      req.userRole = 'admin';
      const middleware = requireRole('admin', 'admin', 'admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle boolean userRole', () => {
      req.userRole = true;
      const middleware = requireRole('admin');

      middleware(req, res, next);

      // boolean true is truthy, so passes first check
      // but doesn't match 'admin', so should return 403
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle numeric userRole', () => {
      req.userRole = 1;
      const middleware = requireRole('admin');

      middleware(req, res, next);

      // number is truthy, so passes first check
      // but doesn't match 'admin', so should return 403
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle when res methods are called', () => {
      req.userRole = 'user';
      const middleware = requireRole('admin');

      middleware(req, res, next);

      // Verify that status returns res for chaining
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should protect admin-only routes', () => {
      const adminOnly = requireRole('admin');

      // Regular user tries to access
      req.userRole = 'user';
      adminOnly(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Admin user accesses
      req.userRole = 'admin';
      adminOnly(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow multiple roles for collaborative features', () => {
      const editorAccess = requireRole('admin', 'editor', 'moderator');

      // Regular user can't access
      req.userRole = 'user';
      editorAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);

      jest.clearAllMocks();

      // Editor can access
      req.userRole = 'editor';
      editorAccess(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Moderator can access
      req.userRole = 'moderator';
      editorAccess(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle unauthenticated request (no auth middleware ran)', () => {
      const middleware = requireRole('admin');

      // Request comes in without auth middleware setting userRole
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });
  });
});
