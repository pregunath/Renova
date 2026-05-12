function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.userRole) return res.status(401).json({ message: 'Unauthorized' });
    if (!allowed.includes(req.userRole)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = requireRole;
