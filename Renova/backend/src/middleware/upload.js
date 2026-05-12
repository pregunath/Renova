const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fieldSize: 50 * 1024 * 1024,
    fileSize: 20 * 1024 * 1024, 
  },
});

module.exports = upload;
