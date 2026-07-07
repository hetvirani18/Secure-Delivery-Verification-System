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

async function sendOtp(req, res) {
    try {
        const deliveryId = Number(req.params.deliveryId);
        const result = await deliveryService.sendOtp({ deliveryId });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            data: result,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to send OTP",
        });
    }
}

async function verifyOtp(req, res) {
    try {
        const deliveryId = Number(req.params.deliveryId);
        const {otp} = req.body;
        const result = await deliveryService.verifyOtp({ deliveryId, otp });

        return res.status(200).json({
            success: true,
            message: "OTP Verified successfully and Delivery is Completed",
            data: result,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to verify OTP",
        });
    }
}

async function getDeliveryHistory(req, res) {
    try {
        const deliveryId = Number(req.params.deliveryId);
        const result = await deliveryService.getDeliveryHistory({ deliveryId });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to get the History",
        });
    }
}

async function getDeliveries(req, res) {
    try {
        const deliveries = await deliveryService.getDeliveries();

        return res.status(200).json({
            success: true,
            data: deliveries,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to fetch deliveries",
        });
    }
}

module.exports = {
    identifyReceiver,
    sendOtp,
    verifyOtp,
    getDeliveryHistory,
    getDeliveries
};
