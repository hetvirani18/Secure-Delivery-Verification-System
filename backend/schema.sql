CREATE DATABASE IF NOT EXISTS securepass;
USE securepass;

CREATE TABLE clients (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    nextInvoiceSeq INT NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (nextInvoiceSeq >= 1)
);

CREATE TABLE receivers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    clientId BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    photoUrl VARCHAR(255) NOT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    duressOffset INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_receiver_client
        FOREIGN KEY (clientId)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    INDEX idx_receivers_clientId (clientId),
    INDEX idx_receivers_client_active (clientId, isActive)
);

CREATE TABLE invoices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    clientId BIGINT NOT NULL,
    invoiceSeq INT NOT NULL,
    invoiceNumber VARCHAR(30) NOT NULL,
    totalValue DECIMAL(12,2) NOT NULL,
    status ENUM('PENDING', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    deliveredAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_invoice_client
        FOREIGN KEY (clientId)
        REFERENCES clients(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_invoice_client_seq UNIQUE (clientId, invoiceSeq),
    CONSTRAINT uq_invoice_number UNIQUE (invoiceNumber),
    CHECK (invoiceSeq >= 1),
    CHECK (totalValue >= 0),

    INDEX idx_invoices_clientId (clientId),
    INDEX idx_invoices_client_status (clientId, status)
);

CREATE TABLE invoice_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    invoiceId BIGINT NOT NULL,
    itemName VARCHAR(150) NOT NULL,
    quantity INT NOT NULL,
    unitValue DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_item_invoice
        FOREIGN KEY (invoiceId)
        REFERENCES invoices(id)
        ON DELETE CASCADE,

    CHECK (quantity > 0),
    CHECK (unitValue >= 0),

    INDEX idx_invoice_items_invoiceId (invoiceId)
);

CREATE TABLE deliveries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    invoiceId BIGINT NOT NULL,
    receiverId BIGINT NULL,
    status ENUM('PENDING', 'IDENTIFIED', 'OTP_SENT', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    identifyAttempts INT NOT NULL DEFAULT 0,
    otpAttempts INT NOT NULL DEFAULT 0,
    otpHash VARCHAR(255),
    otpDuressHash VARCHAR(255),
    otpCreatedAt TIMESTAMP NULL,
    otpExpiresAt TIMESTAMP NULL,
    completedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_delivery_invoice
        FOREIGN KEY (invoiceId)
        REFERENCES invoices(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_delivery_receiver
        FOREIGN KEY (receiverId)
        REFERENCES receivers(id)
        ON DELETE SET NULL,

    CHECK (identifyAttempts BETWEEN 0 AND 3),
    CHECK (otpAttempts BETWEEN 0 AND 3),

    INDEX idx_deliveries_invoiceId (invoiceId),
    INDEX idx_deliveries_receiverId (receiverId),
    INDEX idx_deliveries_status (status),
    INDEX idx_deliveries_invoice_status (invoiceId, status)
);

CREATE TABLE delivery_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    deliveryId BIGINT NOT NULL,
    eventType ENUM(
        'DELIVERY_CREATED',
        'IDENTIFY_ATTEMPT',
        'IDENTIFY_SUCCESS',
        'IDENTIFY_FAILED',
        'OTP_SENT',
        'OTP_VERIFIED',
        'OTP_FAILED',
        'DELIVERY_COMPLETED',
        'DELIVERY_FAILED',
        'DURESS_TRIGGERED'
    ) NOT NULL,
    description TEXT,
    metadata JSON,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_delivery
        FOREIGN KEY (deliveryId)
        REFERENCES deliveries(id)
        ON DELETE RESTRICT,

    INDEX idx_delivery_history_delivery_created (deliveryId, createdAt),
    INDEX idx_delivery_history_eventType (eventType)
);

CREATE TABLE duress_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    deliveryId BIGINT NOT NULL,
    invoiceId BIGINT NOT NULL,
    triggeredAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_duress_delivery
        FOREIGN KEY (deliveryId)
        REFERENCES deliveries(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_duress_invoice
        FOREIGN KEY (invoiceId)
        REFERENCES invoices(id)
        ON DELETE RESTRICT,

    INDEX idx_duress_delivery (deliveryId),
    INDEX idx_duress_resolved (resolved)
);

DELIMITER $$

CREATE TRIGGER trg_delivery_history_no_update
BEFORE UPDATE ON delivery_history
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'delivery_history is append-only';
END$$

CREATE TRIGGER trg_delivery_history_no_delete
BEFORE DELETE ON delivery_history
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'delivery_history is append-only';
END$$

DELIMITER ;