const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/moodboard');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/public', controller.listPublicBoards);
router.get('/presets', controller.listPresets);

router.get('/last', auth, controller.getLastMoodboards);

router.get('/:id', auth, controller.getBoardById);
router.get('/', auth, controller.listUserBoards);

router.post(
  '/',
  auth,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 }
  ]),
  controller.createBoard
);

router.post(
  '/:id/items',
  auth,
  upload.single('file'),
  controller.uploadMoodboardItemImage
);

router.patch(
  '/:id',
  auth,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 }
  ]),
  controller.updateBoardById
);

router.patch('/:id/visibility', auth, controller.toggleBoardVisibility);

router.delete('/:id', auth, controller.deleteBoardById);

router.post("/:id/clone", auth, controller.cloneMoodboard);

router.post("/:id/remove-bg", auth, controller.removeBgForItem);

module.exports = router;
