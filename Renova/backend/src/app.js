const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Dev-only: serve the Jest coverage HTML report at /api/dev/coverage
// Run `npm run test:coverage` first to generate the report.
// This route does NOT exist in production.
if (process.env.NODE_ENV !== 'production') {
  const coverageDir = path.join(__dirname, '../coverage/lcov-report');
  app.use('/api/dev/coverage', express.static(coverageDir));
}

// Mount routes
app.use(routes);

module.exports = app;
