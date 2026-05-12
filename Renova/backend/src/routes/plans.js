const express = require("express");
const auth = require("../middleware/auth");
const c = require("../controllers/plans");
const router = express.Router();

router.get("/", auth, c.listPlans);
router.get("/addons", auth, c.listAddons);
router.get("/current", auth, c.currentPlan);
router.get("/usage", auth, c.usage);
router.post("/checkout-session", auth, c.checkoutSession);
router.post("/checkout-session-embedded", auth, c.checkoutSessionEmbedded);
router.post("/addons/checkout-session-embedded", auth, c.addonCheckoutSessionEmbedded);
router.post("/addons/confirm", auth, c.confirmAddonPurchase);
router.post("/portal-session", auth, c.portalSession);
router.post("/cancel", auth, c.cancelAtPeriodEnd);
router.post("/resume", auth, c.resume);
router.post("/confirm", auth, c.confirmCheckoutAndCleanup);
router.post("/schedule-change", auth, c.scheduleChangeAtPeriodEnd);
router.post("/schedule-cancel", auth, c.cancelScheduledChange);

module.exports = router;