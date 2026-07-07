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

async function createDelivery({ invoiceId }) {
	const id = Number(invoiceId);

	if (!Number.isInteger(id) || id <= 0) {
		const error = new Error("valid invoice id is required");
		error.statusCode = 400;
		throw error;
	}

	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		const [invoiceRows] = await connection.query(
			"SELECT id, clientId, status FROM invoices WHERE id = ? FOR UPDATE",
			[id]
		);

		if (invoiceRows.length === 0) {
			const error = new Error("invoice not found");
			error.statusCode = 404;
			throw error;
		}

		const invoice = invoiceRows[0];

		if (invoice.status === "DELIVERED") {
			const error = new Error("invoice already delivered");
			error.statusCode = 409;
			throw error;
		}

		const [activeDeliveryRows] = await connection.query(
			"SELECT id FROM deliveries WHERE invoiceId = ? AND status IN ('PENDING', 'IDENTIFIED', 'OTP_SENT') LIMIT 1 FOR UPDATE",
			[id]
		);

		if (activeDeliveryRows.length > 0) {
			const error = new Error("active delivery already exists for this invoice");
			error.statusCode = 409;
			throw error;
		}

		const [deliveryResult] = await connection.query(
			"INSERT INTO deliveries (invoiceId, status, identifyAttempts, otpAttempts) VALUES (?, 'PENDING', 0, 0)",
			[id]
		);

		await connection.query(
			"INSERT INTO delivery_history (deliveryId, eventType, description, metadata) VALUES (?, 'DELIVERY_CREATED', ?, JSON_OBJECT('invoiceId', ?, 'clientId', ?))",
			[
				deliveryResult.insertId,
				"Delivery started",
				id,
				invoice.clientId,
			]
		);

		await connection.commit();

		return {
			id: deliveryResult.insertId,
			invoiceId: id,
			status: "PENDING",
			identifyAttempts: 0,
			otpAttempts: 0,
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

async function getInvoices() {
	const [rows] = await pool.query(
		`WITH latest_deliveries AS (
			SELECT
				d.*,
				ROW_NUMBER() OVER (
					PARTITION BY d.invoiceId
					ORDER BY d.createdAt DESC, d.id DESC
				) AS rn
			FROM deliveries d
		)
		SELECT
			i.id,
			i.clientId,
			c.name AS clientName,
			i.invoiceSeq,
			i.invoiceNumber,
			i.totalValue,
			i.status,
			i.createdAt
		FROM invoices i
		INNER JOIN clients c
			ON c.id = i.clientId
		LEFT JOIN latest_deliveries ld
			ON ld.invoiceId = i.id
			AND ld.rn = 1
		WHERE
			i.status = 'PENDING'
			AND (
				ld.id IS NULL
				OR ld.status = 'FAILED'
			)
		ORDER BY i.createdAt DESC, i.id DESC`
	);

	return rows.map((row) => ({
		id: row.id,
		clientId: row.clientId,
		clientName: row.clientName,
		invoiceSeq: row.invoiceSeq,
		invoiceNumber: row.invoiceNumber,
		totalValue: Number(row.totalValue),
		status: row.status,
		createdAt: row.createdAt,
	}));
}

module.exports = {
	createInvoice,
	createDelivery,
	getInvoices,
};
