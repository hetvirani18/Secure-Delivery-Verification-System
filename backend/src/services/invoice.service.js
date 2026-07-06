const pool = require("../config/db.js");

function validateInvoiceInput({ clientId, items }) {
	const id = Number(clientId);

	if (!Number.isInteger(id) || id <= 0) {
		const error = new Error("valid client id is required");
		error.statusCode = 400;
		throw error;
	}

	if (!Array.isArray(items) || items.length === 0) {
		const error = new Error("items must be a non-empty array");
		error.statusCode = 400;
		throw error;
	}

	return id;
}

function normalizeItems(items) {
	return items.map((item, index) => {
		const itemName = item?.itemName?.trim();
		const quantity = Number(item?.quantity);
		const unitValue = Number(item?.unitValue);

		if (!itemName || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitValue) || unitValue < 0) {
			const error = new Error(`invalid item at index ${index}`);
			error.statusCode = 400;
			throw error;
		}

		return {
			itemName,
			quantity,
			unitValue,
		};
	});
}

async function createInvoice({ clientId, items }) {
	const id = validateInvoiceInput({ clientId, items });
	const normalizedItems = normalizeItems(items);
	const totalValue = normalizedItems.reduce(
		(sum, item) => sum + item.quantity * item.unitValue,
		0
	);
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		const [clientRows] = await connection.query(
			"SELECT id, nextInvoiceSeq FROM clients WHERE id = ? FOR UPDATE",
			[id]
		);

		if (clientRows.length === 0) {
			const error = new Error("client not found");
			error.statusCode = 404;
			throw error;
		}

		const client = clientRows[0];
		const invoiceSeq = client.nextInvoiceSeq;
		const invoiceNumber = `CL${id}-${String(invoiceSeq).padStart(4, "0")}`;

		const [invoiceResult] = await connection.query(
			"INSERT INTO invoices (clientId, invoiceSeq, invoiceNumber, totalValue) VALUES (?, ?, ?, ?)",
			[id, invoiceSeq, invoiceNumber, totalValue.toFixed(2)]
		);

		await connection.query(
			"UPDATE clients SET nextInvoiceSeq = nextInvoiceSeq + 1 WHERE id = ?",
			[id]
		);

		for (const item of normalizedItems) {
			await connection.query(
				"INSERT INTO invoice_items (invoiceId, itemName, quantity, unitValue) VALUES (?, ?, ?, ?)",
				[invoiceResult.insertId, item.itemName, item.quantity, item.unitValue.toFixed(2)]
			);
		}

		await connection.commit();

		return {
			id: invoiceResult.insertId,
			clientId: id,
			invoiceSeq,
			invoiceNumber,
			totalValue: Number(totalValue.toFixed(2)),
			status: "PENDING",
			items: normalizedItems,
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

module.exports = {
	createInvoice,
};
