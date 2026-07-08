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
- Add Authorized Receivers (with optional duress offset)
- Create Invoices
- Start Delivery
- Receiver Identification (photo card picker with face match slider)
- OTP Generation (real + duress hash stored, plain never persisted)
- OTP Verification with Silent Duress Alarm and GPS Capture
- Delivery History (append-only audit trail)
- Client Summary (single aggregated SQL query)
- List All Clients
- List Active Receivers per Client
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
- duress_alerts

Design highlights:
- Foreign keys between all core entities
- Money stored using DECIMAL(12,2)
- nextInvoiceSeq on clients for per-client invoice sequencing
- Delivery history append-only protection via triggers
- Indexes on foreign keys and frequent lookup columns
- duressOffset on receivers for silent alarm support
- otpDuressHash on deliveries — both real and duress hashes stored, plain OTP never persisted
- deliveredLatitude / deliveredLongitude on invoices — GPS coords captured at delivery completion
- latitude / longitude on duress_alerts — location stored for emergency dispatch

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
	"photoUrl": "https://example.com/john.jpg",
	"duressOffset": 4821
}
```

`duressOffset` is optional (integer 1–9999). If omitted, a random value is assigned automatically. This is the receiver's secret — used to compute the duress OTP during delivery.

Workflow:
1. Validate client id and receiver payload.
2. Confirm client exists.
3. Assign duressOffset (provided or random).
4. Insert receiver linked to client.
5. Return created receiver including duressOffset.

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
4. Fetch the identified receiver's duressOffset.
5. Generate a random 6-digit real OTP.
6. Compute duress OTP: `(realOtp + duressOffset) % 1000000`.
7. Hash both OTPs with bcrypt — plain values are never stored.
8. Set the delivery to OTP_SENT and store both hashes and the expiry timestamp.
9. Write an OTP_SENT event to delivery_history.
10. Return both OTPs in the response (demo only — in production the duress OTP would be derived client-side).

### 6.7 POST /deliveries/:deliveryId/verify-otp

Purpose:
- Verify the OTP and complete the delivery. Captures GPS coordinates. Silently triggers a duress alert if the duress OTP is used.

Request body:
```json
{
	"otp": "123456",
	"latitude": 23.0225,
	"longitude": 72.5714
}
```

`latitude` and `longitude` are optional. The frontend captures them automatically via `navigator.geolocation` before submitting.

Workflow:
1. Validate delivery id and 6-digit OTP.
2. Start transaction and lock the delivery row.
3. Confirm the delivery exists and is in OTP_SENT state.
4. Reject if OTP is expired.
5. Check submitted OTP against both the real hash and the duress hash (in parallel).
6. If neither matches — increment attempt counter, fail at 3 attempts.
7. If real OTP matches — mark delivery COMPLETED, update invoice to DELIVERED with GPS coords. Write OTP_VERIFIED and DELIVERY_COMPLETED (with coords in metadata) events.
8. If duress OTP matches — same as above (identical 200 response), but additionally insert into duress_alerts (with coords) and write DURESS_TRIGGERED event.

The response is identical for both real and duress paths — an observer cannot distinguish them.

### 6.8 GET /clients

Purpose:
- Return a list of all clients (id, name, phone, createdAt).

Used by the frontend Clients page to populate the client list.

### 6.9 GET /clients/:id/receivers

Purpose:
- Return all active receivers for a client (id, name, phone, photoUrl).

Used by the Run Delivery page to populate the receiver photo card picker.

### 6.10 GET /clients/:id/summary

Purpose:
- Return a summary for a client in a single SQL query.

Response includes:
- Total invoices
- Delivered / pending / failed counts
- Total delivered value
- The receiver who accepted the most deliveries

Workflow:
1. Validate client id.
2. Run a single aggregated SQL query with CTEs — no N+1, no JS loops.
3. Return summary object.

### 6.11 GET /invoices

Purpose:
- Return all PENDING invoices that have no active delivery.

Used by the frontend Run Delivery page to populate the invoice selector.

Workflow:
1. Use a CTE to find the latest delivery per invoice.
2. Return only invoices that are PENDING with no active delivery (or last delivery was FAILED).
3. Return list ordered by most recent first.

### 6.12 GET /deliveries

Purpose:
- Return all deliveries (latest per invoice) with client, receiver, invoice, and last event details.

Used by the frontend board to display all deliveries grouped by status.

Workflow:
1. Use a CTE with ROW_NUMBER to pick the latest delivery per invoice.
2. Join clients, invoices, receivers, and latest history event.
3. Return all deliveries ordered by most recent first.

### 6.13 GET /deliveries/:deliveryId/history

Purpose:
- Return the full append-only audit trail for a single delivery.

Workflow:
1. Validate delivery id.
2. Confirm delivery exists.
3. Return all delivery_history rows for that delivery ordered by createdAt ASC, id ASC.

### 6.14 GET /health

Purpose:
- Verify API and DB connectivity.

Workflow:
1. Run SELECT 1.
2. Return success or failure JSON.

## Part D — Duress PIN + GPS Delivery Proof

Each receiver has a `duressOffset` set at enrollment. When an OTP is generated, the backend computes two valid 6-digit codes:

- **Real OTP** — normal delivery completion.
- **Duress OTP** — `(realOtp + duressOffset) % 1000000` — also completes the delivery with an identical response, but silently inserts into `duress_alerts` and writes a `DURESS_TRIGGERED` event to the audit trail.

Both codes are bcrypt-hashed before storage. The plain values are never persisted.

On any successful verification, the frontend captures GPS coordinates via `navigator.geolocation` and sends them with the request. The backend stores them on the invoice (`deliveredLatitude`, `deliveredLongitude`) and in the `DELIVERY_COMPLETED` history metadata. For duress, the coordinates are also stored in `duress_alerts` — giving ops the exact location to dispatch to.

Demo flow (Run Delivery page):
1. Generate OTP — both codes are ready.
2. **Tap** the reveal button — real OTP fills the input.
3. **Hold 2 seconds** — duress OTP fills the input (looks identical to a watcher).
4. Click Verify OTP — browser requests location, coords are sent with the OTP.
5. Delivery completes either way. Check `duress_alerts` and `invoices` tables to confirm coords were stored.

## 7. Frontend Pages

### Board (`/`)
All deliveries at a glance with status badges (pending, in-progress, completed, failed). Click any delivery to view its full audit trail.

### Delivery Detail (`/deliveries/:id`)
Full append-only audit timeline for a delivery. Shows all events with human-readable labels, face match scores, OTP attempts, GPS coordinates with a Google Maps link on completion, and duress alerts if triggered.

### Run Delivery (`/run-delivery`)
Step-by-step delivery flow simulator:
- Select a pending invoice
- Pick a receiver from photo cards (auto-loaded for that client)
- Adjust face match score with a slider (green ≥85, red below)
- Generate OTP — tap to reveal real code, hold 2s for duress code
- Submit OTP — browser captures GPS coordinates automatically

### Clients (`/clients`)
List of all clients. Click any client to load their summary: total invoices, delivered/pending/failed counts, total delivered value, and the top receiver by completed deliveries.

## 8. Installation

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