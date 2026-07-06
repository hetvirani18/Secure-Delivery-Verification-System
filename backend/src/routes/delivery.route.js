const express = require("express");
const { identifyReceiver } = require("../controllers/delivery.controller.js");

const router = express.Router();

router.post("/:deliveryId/identify", identifyReceiver)

module.exports = router;
