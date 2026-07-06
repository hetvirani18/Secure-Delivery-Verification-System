const express = require("express");
const { createInvoice } = require("../controllers/invoice.controller.js");

const router = express.Router();

router.post("/", createInvoice);

module.exports = router;
