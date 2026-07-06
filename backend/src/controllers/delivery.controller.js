const deliveryService = require("../services/delivery.service.js");

async function identifyReceiver(req, res) {
    try {
        const deliveryId = Number(req.params.deliveryId);
        const { receiverId, similarity } = req.body;
        const result = await deliveryService.identifyReceiver({ deliveryId, receiverId, similarity });

        return res.status(200).json({
            success: true,
            message: "Receiver identified successfully",
            data: result,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to identify receiver",
        });
    }
}

module.exports = {
    identifyReceiver
};
