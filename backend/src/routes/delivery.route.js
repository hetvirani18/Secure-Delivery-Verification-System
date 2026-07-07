const express = require("express");
const { identifyReceiver, sendOtp, verifyOtp, getDeliveryHistory, getDeliveries } = require("../controllers/delivery.controller.js");

const router = express.Router();

router.post("/:deliveryId/identify", identifyReceiver)
router.post("/:deliveryId/send-otp", sendOtp);
router.post("/:deliveryId/verify-otp", verifyOtp);
router.get("/:deliveryId/history", getDeliveryHistory);
router.get("/", getDeliveries);

module.exports = router;