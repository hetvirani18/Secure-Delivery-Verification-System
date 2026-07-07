const express = require("express");
const { identifyReceiver, sendOtp, verifyOtp, getDeliveryHistory } = require("../controllers/delivery.controller.js");

const router = express.Router();

router.post("/:deliveryId/identify", identifyReceiver)
router.post("/:deliveryId/send-otp", sendOtp);
router.post("/:deliveryId/verify-otp", verifyOtp);
router.get("/:deliveryId/history", getDeliveryHistory);

module.exports = router;