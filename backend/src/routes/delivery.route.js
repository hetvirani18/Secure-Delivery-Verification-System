const express = require("express");
const { identifyReceiver, sendOtp, verifyOtp } = require("../controllers/delivery.controller.js");

const router = express.Router();

router.post("/:deliveryId/identify", identifyReceiver)
router.post("/:deliveryId/send-otp", sendOtp);
router.post("/:deliveryId/verify-otp", verifyOtp);

module.exports = router;