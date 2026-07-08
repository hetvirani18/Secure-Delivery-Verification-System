const express = require("express");
const {
    createClient,
    addReceiver,
    getClientSummary,
    getClientReceivers
} = require("../controllers/client.controller.js");

const router = express.Router();

router.post("/", createClient);
router.post("/:id/receivers", addReceiver);
router.get("/:id/receivers", getClientReceivers);
router.get("/:id/summary", getClientSummary);

module.exports = router;