const invoiceService = require("../services/invoice.service.js");

async function createInvoice(req, res) {
	try {
		const { clientId, items } = req.body;
		const invoice = await invoiceService.createInvoice({ clientId, items });

		return res.status(201).json({
			success: true,
			message: "Invoice created successfully",
			data: invoice,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to create invoice",
		});
	}
}

async function createDelivery(req, res) {
	try {
		const invoiceId = Number(req.params.invoiceId);
		const delivery = await invoiceService.createDelivery({ invoiceId });

		return res.status(201).json({
			success: true,
			message: "Delivery started successfully",
			data: delivery,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to start delivery",
		});
	}
}

async function getInvoices(req, res) {
	try {
		const invoices = await invoiceService.getInvoices();

		return res.status(200).json({
			success: true,
			data: invoices,
		});
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Failed to fetch invoices",
		});
	}
}

module.exports = {
	createInvoice,
	createDelivery,
	getInvoices,
};
