const express = require("express");
const { createInvoice, createDelivery } = require("../controllers/invoice.controller.js");

const router = express.Router();

router.post("/", createInvoice);
router.post("/:invoiceId/deliveries", createDelivery);

module.exports = router;
