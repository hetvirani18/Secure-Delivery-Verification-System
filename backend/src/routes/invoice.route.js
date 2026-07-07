const express = require("express");
const { createInvoice, createDelivery, getInvoices } = require("../controllers/invoice.controller.js");

const router = express.Router();

router.post("/", createInvoice);
router.get("/", getInvoices);
router.post("/:invoiceId/deliveries", createDelivery);

module.exports = router;
