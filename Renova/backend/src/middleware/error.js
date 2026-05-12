function errorHandler(err, req, res, next) {
  console.error(err); // can be replaced with logger later

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ message });
}

module.exports = errorHandler;
