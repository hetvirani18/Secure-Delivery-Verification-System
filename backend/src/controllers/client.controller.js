const clientService = require("../services/client.services.js");

async function createClient(req, res) {
	try {
		const { name, phone } = req.body;
		const client = await clientService.createClient({ name, phone });

		return res.status(201).json({
			success: true,
			message: "Client created successfully",
			data: client,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to create client",
		});
	}
}

async function addReceiver(req, res) {
	try {
		const clientId = Number(req.params.id);
		const { name, phone, photoUrl } = req.body;
		const receiver = await clientService.addReceiver({
			clientId,
			name,
			phone,
			photoUrl,
		});

		return res.status(201).json({
			success: true,
			message: "Receiver added successfully",
			data: receiver,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to add receiver",
		});
	}
}

async function getClientSummary(req, res) {
	//to be done
}

module.exports = {
	createClient,
	addReceiver,
	getClientSummary,
};
