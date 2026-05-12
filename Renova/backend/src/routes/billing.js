// backend/src/routes/billing.js
const express = require('express');
const auth = require('../middleware/auth');
const c = require('../controllers/billing');

const router = express.Router();

router.post('/setup-intent', auth, c.createSetupIntent); //NEW: adding for having a embedded checkout -EB
router.get("/invoices/:id/details", auth, c.getInvoiceDetails);  //NEW: for invoice to be viewed in renova -EB
router.get("/invoices/:id/pdf", auth, c.getInvoicePdf); //download/backup/ invoices -EB

router.get('/sources', auth, c.listSources);
router.post('/sources', auth, c.attachSource);
router.post('/default-source', auth, c.setDefaultSource);
router.delete('/sources/:id', auth, c.detachSource);

router.get('/address', auth, c.getAddress);
router.patch('/address', auth, c.updateAddress);

router.get('/invoices', auth, c.listInvoices);

module.exports = router;
