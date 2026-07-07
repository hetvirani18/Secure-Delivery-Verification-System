const pool = require("../config/db.js");
const bcrypt = require("bcrypt");

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

async function sendOtp({ deliveryId }) {
    const id = Number(deliveryId);

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error("Valid delivery id is required");
        error.statusCode = 400;
        throw error;
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [deliveryRows] = await connection.query(
            `SELECT id,
                    status
             FROM deliveries
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );

        if (deliveryRows.length === 0) {
            const error = new Error("Delivery not found");
            error.statusCode = 404;
            throw error;
        }

        const delivery = deliveryRows[0];

        if (delivery.status !== "IDENTIFIED") {
            const error = new Error(
                "OTP can only be sent after successful identification"
            );
            error.statusCode = 409;
            throw error;
        }

        // Generate random 6-digit OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Hash OTP
        const otpHash = await bcrypt.hash(otp, 10);

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 3 * 60 * 1000);

        await connection.query(
            `UPDATE deliveries
             SET otpHash = ?,
                 otpCreatedAt = ?,
                 otpExpiresAt = ?,
                 status = 'OTP_SENT',
                 otpAttempts = 0
             WHERE id = ?`,
            [
                otpHash,
                now,
                expiresAt,
                id
            ]
        );

        await connection.query(
            `INSERT INTO delivery_history
            (
                deliveryId,
                eventType,
                description,
                metadata
            )
            VALUES
            (
                ?,
                'OTP_SENT',
                ?,
                JSON_OBJECT(
                    'expiresAt', ?
                )
            )`,
            [
                id,
                "OTP generated successfully",
                expiresAt
            ]
        );

        await connection.commit();

        return {
            deliveryId: id,
            otp,
            expiresAt,
            status: "OTP_SENT"
        };

    } catch (error) {

        await connection.rollback();
        throw error;

    } finally {

        connection.release();

    }
}

async function verifyOtp({ deliveryId, otp }) {
    const id = deliveryId;

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error("Valid delivery id is required");
        error.statusCode = 400;
        throw error;
    }

    if (!otp || otp.toString().trim().length !== 6) {
        const error = new Error("Valid 6-digit OTP is required");
        error.statusCode = 400;
        throw error;
    }

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const [deliveryRows] = await connection.query(
            `SELECT
                id,
                invoiceId,
                status,
                otpHash,
                otpAttempts,
                otpExpiresAt
             FROM deliveries
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );

        if (deliveryRows.length === 0) {
            const error = new Error("Delivery not found");
            error.statusCode = 404;
            throw error;
        }

        const delivery = deliveryRows[0];

        if (delivery.status !== "OTP_SENT") {
            const error = new Error(
                "OTP verification is not allowed"
            );
            error.statusCode = 409;
            throw error;
        }

        if (new Date() > new Date(delivery.otpExpiresAt)) {

            await connection.query(
                `UPDATE deliveries
                 SET status='IDENTIFIED'
                 WHERE id=?`,
                [id]
            );

            await connection.query(
                `INSERT INTO delivery_history
                (deliveryId,eventType,description,metadata)
                VALUES
                (?, 'OTP_FAILED', ?, JSON_OBJECT(
                    'reason','OTP expired'
                ))`,
                [
                    id,
                    "OTP expired"
                ]
            );

            await connection.commit();

            const error = new Error("OTP has expired. Please request a new OTP.");
            error.statusCode = 409;
            throw error;
        }

        const isValid = await bcrypt.compare(
            otp.toString(),
            delivery.otpHash
        );

        if (!isValid) {

            const attempts = delivery.otpAttempts + 1;

            const status = attempts >= 3 ? "FAILED" : "OTP_SENT";

            await connection.query(
                `UPDATE deliveries
                 SET otpAttempts=?,
                     status=?
                 WHERE id=?`,
                [
                    attempts,
                    status,
                    id
                ]
            );

            await connection.query(
                `INSERT INTO delivery_history
                (deliveryId,eventType,description,metadata)
                VALUES
                (?, 'OTP_FAILED', ?, JSON_OBJECT(
                    'attempt',?
                ))`,
                [
                    id,
                    "Incorrect OTP",
                    attempts
                ]
            );

            await connection.commit();

            const error = new Error("Incorrect OTP");
            error.statusCode = 409;
            throw error;
        }

        // OTP Correct

        await connection.query(
            `UPDATE deliveries
             SET status='COMPLETED',
                 completedAt=NOW()
             WHERE id=?`,
            [id]
        );

        await connection.query(
            `UPDATE invoices
             SET status='DELIVERED',
                 deliveredAt=NOW()
             WHERE id=?`,
            [delivery.invoiceId]
        );

        await connection.query(
            `INSERT INTO delivery_history
            (deliveryId,eventType,description,metadata)
            VALUES
            (?, 'OTP_VERIFIED', ?, JSON_OBJECT())`,
            [
                id,
                "OTP verified successfully"
            ]
        );

        await connection.query(
            `INSERT INTO delivery_history
            (deliveryId,eventType,description,metadata)
            VALUES
            (?, 'DELIVERY_COMPLETED', ?, JSON_OBJECT())`,
            [
                id,
                "Delivery completed"
            ]
        );

        await connection.commit();

        return {
            deliveryId: id,
            invoiceId: delivery.invoiceId,
            status: "COMPLETED"
        };

    } catch (error) {

        await connection.rollback();
        throw error;

    } finally {

        connection.release();

    }
}

async function getDeliveryHistory({ deliveryId }) {

    const id = deliveryId;

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error("Valid delivery id is required");
        error.statusCode = 400;
        throw error;
    }

    // Check delivery exists
    const [deliveryRows] = await pool.query(
        `SELECT id
         FROM deliveries
         WHERE id = ?`,
        [id]
    );

    if (deliveryRows.length === 0) {
        const error = new Error("Delivery not found");
        error.statusCode = 404;
        throw error;
    }

    // Fetch audit trail
    const [historyRows] = await pool.query(
        `SELECT
            eventType,
            description,
            metadata,
            createdAt
         FROM delivery_history
         WHERE deliveryId = ?
         ORDER BY createdAt ASC, id ASC`,
        [id]
    );

    return {
        deliveryId: id,
        totalEvents: historyRows.length,
        history: historyRows
    };
}

module.exports = {
    identifyReceiver,
    sendOtp,
    verifyOtp,
    getDeliveryHistory
};