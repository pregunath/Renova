const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/user');
const upload = require('../middleware/upload');

const router = express.Router();

// Self
router.get('/me', auth, controller.getMe);
router.patch(
  '/me',
  auth,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'bgImage', maxCount: 1 }
  ]),
  controller.updateMe
);

// Admin-only
router.get('/', auth, requireRole('admin'), controller.listUsers);
router.get('/:id', auth, requireRole('admin'), controller.getUserById);

router.patch(
  '/:id',
  auth,
  requireRole('admin'),
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'bgImage', maxCount: 1 }
  ]),
  controller.updateUserById
);

router.delete('/:id', auth, requireRole('admin'), controller.deleteUserById);

module.exports = router;
