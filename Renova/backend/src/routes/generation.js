const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/generation');
const upload = require('../middleware/upload');

const router = express.Router();

// list all public generations
router.get('/public', controller.listPublicGenerations);

// get all generations for the current user
router.get('/', auth, controller.listUserGenerations);

// get all generations for a specific moodboard
router.get('/board/:moodboardId', auth, controller.listUserGenerationsForBoard);

// Create a new generation
router.post(
  '/',
  auth,
  upload.fields([
    { name: 'baseImage', maxCount: 1 },
    { name: 'inputItems' }, 
  ]),
  controller.createGeneration
);

// attach generations to a moodboard
router.patch('/attach-to-board', auth, controller.attachGenerationsToBoard);

// delete a generation for the current user
router.delete('/:id', auth, controller.deleteGeneration);

// toggle visibility
router.patch('/:id/visibility', auth, controller.toggleGenerationVisibility);

// admin-only endpoints
router.get('/admin/all', auth, requireRole('admin'), controller.listAllGenerations);
router.patch('/admin/:id', auth, requireRole('admin'), controller.updateGenerationById);
router.delete('/admin/:id', auth, requireRole('admin'), controller.adminDeleteGenerationById);

module.exports = router;
