const pool = require("../config/db.js");

function validateClientId(clientId) {
	const id = Number(clientId);

	if (!Number.isInteger(id) || id <= 0) {
		const error = new Error("valid client id is required");
		error.statusCode = 400;
		throw error;
	}

	return id;
}

function validateClientInput({ name, phone }) {
	if (!name || !phone) {
		const error = new Error("name and phone are required");
		error.statusCode = 400;
		throw error;
	}
}

function validateReceiverInput({ clientId, name, phone, photoUrl, duressOffset }) {
	if (!clientId || Number.isNaN(clientId) || clientId < 1) {
		const error = new Error("valid client id is required");
		error.statusCode = 400;
		throw error;
	}

	if (!name || !phone || !photoUrl) {
		const error = new Error("name, phone, and photo_url are required");
		error.statusCode = 400;
		throw error;
	}

	if (duressOffset !== undefined) {
		const offset = Number(duressOffset);
		if (!Number.isInteger(offset) || offset < 1 || offset > 9999) {
			const error = new Error("duressOffset must be an integer between 1 and 9999");
			error.statusCode = 400;
			throw error;
		}
	}
}

async function createClient({ name, phone }) {
	validateClientInput({ name, phone });

	const [result] = await pool.query(
		"INSERT INTO clients (name, phone) VALUES (?, ?)",
		[name.trim(), phone.trim()]
	);

	return {
		id: result.insertId,
		name: name.trim(),
		phone: phone.trim(),
	};
}

async function addReceiver({ clientId, name, phone, photoUrl, duressOffset }) {
	validateReceiverInput({ clientId, name, phone, photoUrl, duressOffset });

	const [clientRows] = await pool.query(
		"SELECT id FROM clients WHERE id = ?",
		[clientId]
	);

	if (clientRows.length === 0) {
		const error = new Error("client not found");
		error.statusCode = 404;
		throw error;
	}

	// Use provided offset or generate a random one (1–9999)
	const offset = duressOffset ? Number(duressOffset) : Math.floor(Math.random() * 9999) + 1;

	const [result] = await pool.query(
		"INSERT INTO receivers (clientId, name, phone, photoUrl, duressOffset) VALUES (?, ?, ?, ?, ?)",
		[clientId, name.trim(), phone.trim(), photoUrl.trim(), offset]
	);

	return {
		id: result.insertId,
		clientId,
		name: name.trim(),
		phone: phone.trim(),
		photoUrl: photoUrl.trim(),
		duressOffset: offset,
		isActive: true,
	};
}

async function getClientSummary(clientId) {
	const id = validateClientId(clientId);

	const [rows] = await pool.query(
		`WITH latest_deliveries AS (
			SELECT
				d.invoiceId,
				d.status,
				ROW_NUMBER() OVER (
					PARTITION BY d.invoiceId
					ORDER BY d.createdAt DESC, d.id DESC
				) AS rn
			FROM deliveries d
		),
		top_receiver AS (
			SELECT
				r.id AS receiverId,
				r.name AS receiverName,
				COUNT(*) AS deliveryCount
			FROM deliveries d
			INNER JOIN invoices i
				ON i.id = d.invoiceId
			INNER JOIN receivers r
				ON r.id = d.receiverId
			WHERE i.clientId = ?
				AND d.status = 'COMPLETED'
			GROUP BY r.id, r.name
			ORDER BY deliveryCount DESC, r.id ASC
			LIMIT 1
		)
		SELECT
			c.id,
			c.name,
			c.phone,
			COUNT(DISTINCT i.id) AS totalInvoices,
			COALESCE(SUM(CASE WHEN i.status = 'DELIVERED' THEN 1 ELSE 0 END), 0) AS deliveredCount,
			COALESCE(SUM(CASE WHEN i.status = 'PENDING' AND (ld.status IS NULL OR ld.status <> 'FAILED') THEN 1 ELSE 0 END), 0) AS pendingCount,
			COALESCE(SUM(CASE WHEN i.status = 'PENDING' AND ld.status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failedCount,
			COALESCE(SUM(CASE WHEN i.status = 'DELIVERED' THEN i.totalValue ELSE 0 END), 0) AS totalDeliveredValue,
			tr.receiverName AS topReceiver,
			tr.receiverId AS topReceiverId,
			COALESCE(tr.deliveryCount, 0) AS topReceiverDeliveries
		FROM clients c
		LEFT JOIN invoices i
			ON i.clientId = c.id
		LEFT JOIN latest_deliveries ld
			ON ld.invoiceId = i.id
			AND ld.rn = 1
		LEFT JOIN top_receiver tr
			ON 1 = 1
		WHERE c.id = ?
		GROUP BY c.id, c.name, c.phone, tr.receiverName, tr.deliveryCount, tr.receiverId`,
		[id, id]
	);

	if (rows.length === 0) {
		const error = new Error("client not found");
		error.statusCode = 404;
		throw error;
	}

	const summary = rows[0];

	return {
		id: summary.id,
		name: summary.name,
		phone: summary.phone,
		totalInvoices: Number(summary.totalInvoices),
		deliveredCount: Number(summary.deliveredCount),
		pendingCount: Number(summary.pendingCount),
		failedCount: Number(summary.failedCount),
		totalDeliveredValue: Number(summary.totalDeliveredValue),
		topReceiver: summary.topReceiver
			? {
				id: summary.topReceiverId,
				name: summary.topReceiver,
				deliveryCount: Number(summary.topReceiverDeliveries),
			}
			: null,
	};
}

async function getClientReceivers(clientId) {
	const id = validateClientId(clientId);

	const [clientRows] = await pool.query(
		"SELECT id FROM clients WHERE id = ?",
		[id]
	);

	if (clientRows.length === 0) {
		const error = new Error("client not found");
		error.statusCode = 404;
		throw error;
	}

	const [rows] = await pool.query(
		`SELECT id, name, phone, photoUrl, isActive
		 FROM receivers
		 WHERE clientId = ? AND isActive = TRUE
		 ORDER BY name ASC`,
		[id]
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		phone: r.phone,
		photoUrl: r.photoUrl,
		isActive: Boolean(r.isActive),
	}));
}

async function getAllClients() {
	const [rows] = await pool.query(
		`SELECT id, name, phone, createdAt FROM clients ORDER BY name ASC`
	);
	return rows;
}

module.exports = {
	createClient,
	addReceiver,
	getClientReceivers,
	getClientSummary,
	getAllClients,
};
