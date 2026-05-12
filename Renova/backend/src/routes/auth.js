const express = require('express');
const auth = require('../middleware/auth');
const { register, login, refresh, googleLogin, changePassword } = require('../controllers/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/google', googleLogin);
router.post('/change-password', auth, changePassword);


module.exports = router;
