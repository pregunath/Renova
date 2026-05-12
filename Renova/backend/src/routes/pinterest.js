const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/pinterest');

const router = express.Router();

router.get('/auth-url', auth, controller.getPinterestAuthUrl);
router.get('/callback', controller.handlePinterestCallback); // Remove auth middleware from callback
router.get('/status', auth, controller.getPinterestStatus);
router.get('/boards', auth, controller.getPinterestBoards);
router.get('/boards/:boardId/pins', auth, controller.getPinsByBoard);
router.get('/pins', auth, controller.getPinterestPins);
router.post('/disconnect', auth, controller.disconnectPinterest);

module.exports = router;