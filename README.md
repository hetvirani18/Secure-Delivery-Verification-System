# Secure Delivery Verification System

## 1. Overview

A backend system that securely manages package deliveries using
receiver identification, OTP verification, transactional invoice
creation, and an append-only audit trail.

The project focuses on correctness under concurrent requests by
using MySQL transactions and row-level locking.

## 2. Tech Stack

- Node.js
- Express.js
- MySQL
- mysql2

## 3. Features


- Create Clients
- Add Authorized Receivers
- Create Invoices
- Start Delivery
- Receiver Identification
- OTP Generation
- OTP Verification
- Delivery History
- Client Summary
- Concurrency Safe Invoice Generation
- Concurrency Safe Delivery Creation

## 4. System Workflow

Current implemented workflow:

Create Client
-> Add Receivers
-> Create Invoice
-> Start Delivery

Identify Receiver
-> Send OTP
-> Verify OTP
-> Delivery Completed

Delivery endpoints are mounted under `/deliveries`.

## 5. Database Design

Main tables:
- clients
- receivers
- invoices
- invoice_items
- deliveries
- delivery_history

Design highlights:
- Foreign keys between all core entities
- Money stored using DECIMAL(12,2)
- nextInvoiceSeq on clients for per-client invoice sequencing
- Delivery history append-only protection via triggers
- Indexes on foreign keys and frequent lookup columns

Schema file:
- backend/schema.sql

## 6. API Endpoints


### 6.1 POST /clients

Purpose:
- Create a client.

Request body:
```json
{
	"name": "ACME Corp",
	"phone": "9876543210"
}
```

Workflow:
1. Validate name and phone.
2. Insert into clients.
3. Return created client.

### 6.2 POST /clients/:id/receivers

Purpose:
- Add an authorized receiver to a client.

Request body:
```json
{
	"name": "John Receiver",
	"phone": "9990011223",
	"photoUrl": "https://example.com/john.jpg"
}
```

Workflow:
1. Validate client id and receiver payload.
2. Confirm client exists.
3. Insert receiver linked to client.
4. Return created receiver.

### 6.3 POST /invoices

Purpose:
- Create an invoice with one or more line items.

Request body:
```json
{
	"clientId": 1,
	"items": [
		{ "itemName": "Gold Coin", "quantity": 1, "unitValue": 50000 }
	]
}
```

Workflow:
1. Validate client id and items.
2. Start transaction.
3. Lock client row with FOR UPDATE.
4. Read nextInvoiceSeq and build invoice number.
5. Insert invoice.
6. Increment client nextInvoiceSeq.
7. Insert invoice items.
8. Commit transaction.

### 6.4 POST /invoices/:invoiceId/deliveries

Purpose:
- Start a delivery attempt for an invoice.

Request body:
```json
{}
```

Workflow:
1. Validate invoice id.
2. Start transaction.
3. Lock invoice row with FOR UPDATE.
4. Reject if invoice already DELIVERED.
5. Check active delivery exists with status in PENDING, IDENTIFIED, OTP_SENT.
6. Reject with conflict if active delivery exists.
7. Insert delivery with PENDING state.
8. Insert DELIVERY_CREATED event into delivery_history.
9. Commit transaction.

### 6.5 POST /deliveries/:deliveryId/identify

Purpose:
- Identify the receiver for an active delivery.

Request body:
```json
{
	"receiverId": 12,
	"similarity": 92
}
```

Workflow:
1. Validate delivery id, receiver id, and similarity score.
2. Start transaction and lock the delivery row.
3. Confirm the delivery exists and is in PENDING state.
4. Confirm the receiver exists, belongs to the same client, and is active.
5. Require similarity score to be at least 85.
6. Update the delivery to IDENTIFIED and store the receiver id.
7. Write an identify success or failure event to delivery_history.

### 6.6 POST /deliveries/:deliveryId/send-otp

Purpose:
- Generate and store a time-limited OTP after successful identification.

Request body:
```json
{}
```

Workflow:
1. Validate delivery id.
2. Start transaction and lock the delivery row.
3. Confirm the delivery exists and is in IDENTIFIED state.
4. Generate a random 6-digit OTP and hash it before storage.
5. Set the delivery to OTP_SENT and store the OTP expiry timestamp.
6. Write an OTP_SENT event to delivery_history.

### 6.7 POST /deliveries/:deliveryId/verify-otp

Purpose:
- Verify the OTP and complete the delivery.

Request body:
```json
{
	"otp": "123456"
}
```

Workflow:
1. Validate delivery id and 6-digit OTP.
2. Start transaction and lock the delivery row.
3. Confirm the delivery exists and is in OTP_SENT state.
4. Reject the OTP if it is expired.
5. Compare the supplied OTP with the stored hash.
6. On success, mark the delivery COMPLETED and the invoice DELIVERED.
7. Write OTP verification and delivery completion events to delivery_history.

### 6.8 GET /health

Purpose:
- Verify API and DB connectivity.

Workflow:
1. Run SELECT 1.
2. Return success or failure JSON.

## 7. Installation

1. Clone the repository.
2. Move into backend folder.
3. Install dependencies.

```bash
cd backend
npm install
```

## 8. Environment Variables

Create backend/.env with:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=securepass
PORT=5000
BASE_URL=http://localhost:5000
```

## 9. Running the Project

1. Run backend/schema.sql on MySQL 8.
2. Start backend server.

```bash
cd backend
npm run dev
```

## 10. Running Concurrency Test

This test fires multiple parallel requests to start delivery for the same invoice.

```bash
cd backend
node scripts/concurrency-delivery-test.js
```

Expected condition:
- Exactly one request succeeds with 201.
- Remaining requests return 409 conflict.

## 11. Sample Output

Example:

```text
Creating test data...
Invoice: 42

===== RESULT =====
Successful deliveries : 1
Conflicts             : 19
Concurrency test PASSED
```

## 12. Folder Structure

```text
Secure-Delivery-Verification-System/
├── backend/
│   ├── schema.sql
│   ├── package.json
│   ├── scripts/
│   │   └── concurrency-delivery-test.js
│   └── src/
│       ├── config/
│       │   └── db.js
│       ├── controllers/
│       │   ├── client.controller.js
│       │   ├── delivery.controller.js
│       │   └── invoice.controller.js
│       ├── routes/
│       │   ├── client.route.js
│       │   ├── delivery.route.js
│       │   └── invoice.route.js
│       ├── services/
│       │   ├── client.service.js
│       │   ├── delivery.service.js
│       │   └── invoice.service.js
│       └── index.js
├── DECISIONS.md
└── README.md
```