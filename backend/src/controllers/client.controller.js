const clientService = require("../services/client.service.js");

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
		const { name, phone, photoUrl, duressOffset } = req.body;
		const receiver = await clientService.addReceiver({
			clientId,
			name,
			phone,
			photoUrl,
			duressOffset,
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
	try {
		const clientId = Number(req.params.id);
		const summary = await clientService.getClientSummary(clientId);

		return res.status(200).json({
			success: true,
			data: summary,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to fetch client summary",
		});
	}
}

async function getClientReceivers(req, res) {
	try {
		const clientId = Number(req.params.id);
		const receivers = await clientService.getClientReceivers(clientId);

		return res.status(200).json({
			success: true,
			data: receivers,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to fetch receivers",
		});
	}
}

async function getAllClients(req, res) {
	try {
		const clients = await clientService.getAllClients();
		return res.status(200).json({ success: true, data: clients });
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to fetch clients",
		});
	}
}

module.exports = {
	createClient,
	addReceiver,
	getClientSummary,
	getClientReceivers,
	getAllClients,
};
