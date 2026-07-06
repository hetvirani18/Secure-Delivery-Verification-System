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

module.exports = {
	createInvoice,
};
