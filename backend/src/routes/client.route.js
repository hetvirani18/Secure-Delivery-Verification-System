const express = require("express");
const {
    createClient,
    addReceiver,
    getClientSummary,
    getClientReceivers,
    getAllClients
} = require("../controllers/client.controller.js");

const router = express.Router();

router.get("/", getAllClients);
router.post("/", createClient);
router.post("/:id/receivers", addReceiver);
router.get("/:id/receivers", getClientReceivers);
router.get("/:id/summary", getClientSummary);

module.exports = router;