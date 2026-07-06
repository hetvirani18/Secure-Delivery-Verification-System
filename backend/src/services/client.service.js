const pool = require("../config/db.js");

function validateClientInput({ name, phone }) {
	if (!name || !phone) {
		const error = new Error("name and phone are required");
		error.statusCode = 400;
		throw error;
	}
}

function validateReceiverInput({ clientId, name, phone, photoUrl }) {
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

async function addReceiver({ clientId, name, phone, photoUrl }) {
	validateReceiverInput({ clientId, name, phone, photoUrl });

	const [clientRows] = await pool.query(
		"SELECT id FROM clients WHERE id = ?",
		[clientId]
	);

	if (clientRows.length === 0) {
		const error = new Error("client not found");
		error.statusCode = 404;
		throw error;
	}

	const [result] = await pool.query(
		"INSERT INTO receivers (clientId, name, phone, photoUrl) VALUES (?, ?, ?, ?)",
		[clientId, name.trim(), phone.trim(), photoUrl.trim()]
	);

	return {
		id: result.insertId,
		clientId,
		name: name.trim(),
		phone: phone.trim(),
		photoUrl: photoUrl.trim(),
		isActive: true,
	};
}

async function getClientSummary(clientId) {
	//to be done
}

module.exports = {
	createClient,
	addReceiver,
	getClientSummary,
};
