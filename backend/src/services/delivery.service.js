const pool = require("../config/db.js");

function validateIdentifyInput({ deliveryId, receiverId, similarity }) {

    const id = Number(deliveryId);
    const receiver = Number(receiverId);
    const score = Number(similarity);

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error("valid delivery id is required");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(receiver) || receiver <= 0) {
        const error = new Error("valid receiver id is required");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isFinite(score) || score < 0 || score > 100) {
        const error = new Error("valid similarity score is required (0-100)");
        error.statusCode = 400;
        throw error;
    }

    return { id, receiver, score };
}

async function failIdentification (connection, id, receiverId, score, reason, attempts) {
    attempts = attempts + 1;

    let status = "PENDING";

    if (attempts >= 3)
        status = "FAILED";

    await connection.query(
        `UPDATE deliveries
            SET identifyAttempts=?,
                status=?
            WHERE id=?`,
        [attempts, status, id]
    );

    await connection.query(
        `INSERT INTO delivery_history
        (deliveryId,eventType,description,metadata)
        VALUES
        (?, 'IDENTIFY_FAILED', ?, JSON_OBJECT(
            'receiverId',?,
            'similarity',?
        ))`,
        [
            id,
            reason,
            receiverId,
            score
        ]
    );

    await connection.commit();

    throw Object.assign(
        new Error(`Identification failed: ${reason}`),
        { statusCode: 409 }
    );
}

async function identifyReceiver({ deliveryId, receiverId, similarity }) {

    const { id, receiver, score } = validateIdentifyInput({ deliveryId, receiverId, similarity });

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const [deliveryRows] = await connection.query(
            `SELECT d.id,
                    d.invoiceId,
                    d.identifyAttempts,
                    d.status,
                    i.clientId
             FROM deliveries d
             INNER JOIN invoices i
                ON d.invoiceId = i.id
             WHERE d.id = ?
             FOR UPDATE`,
            [id]
        );

        if (deliveryRows.length === 0) {
            const error = new Error("Delivery not found");
            error.statusCode = 404;
            throw error;
        }

        const delivery = deliveryRows[0];

        if (delivery.status !== "PENDING") {
            const error = new Error("Delivery is not in PENDING state");
            error.statusCode = 409;
            throw error;
        }

        if (delivery.identifyAttempts >= 3) {
            const error = new Error("Maximum identify attempts exceeded");
            error.statusCode = 409;
            throw error;
        }

        const [receiverRows] = await connection.query(
            `SELECT id,
                    clientId,
                    isActive
             FROM receivers
             WHERE id = ?`,
            [receiver]
        );

        if (receiverRows.length === 0) {
            const error = new Error("Receiver not found");
            error.statusCode = 404;
            throw error;
        }

        const dbReceiver = receiverRows[0];

        if ( dbReceiver.clientId !== delivery.clientId || !dbReceiver.isActive ) {
           await failIdentification(connection, id, receiver, score, "Receiver does not belong to the client or is inactive", delivery.identifyAttempts);
        }

        if (score < 85) {
            await failIdentification(connection, id, receiver, score, "Similarity score below threshold", delivery.identifyAttempts);
        }

        await connection.query(
            `UPDATE deliveries
             SET receiverId=?,
                 status='IDENTIFIED'
             WHERE id=?`,
            [receiver, id]
        );

        await connection.query(
            `INSERT INTO delivery_history
            (deliveryId,eventType,description,metadata)
            VALUES
            (?, 'IDENTIFY_SUCCESS', ?, JSON_OBJECT(
                'receiverId',?,
                'similarity',?
            ))`,
            [
                id,
                "Receiver identified",
                receiver,
                score
            ]
        );

        await connection.commit();

        return {
            deliveryId: id,
            receiverId: receiver,
            similarity: score,
            status: "IDENTIFIED"
        };

    } catch (err) {

        await connection.rollback();
        throw err;

    } finally {
        connection.release();
    }
}

module.exports = {
    identifyReceiver
};