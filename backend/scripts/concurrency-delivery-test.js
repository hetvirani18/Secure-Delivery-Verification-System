require('dotenv/config');
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const TOTAL_REQUESTS = 20;

async function createClient() {
    const response = await fetch(`${BASE_URL}/clients`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: "Test Client",
            phone: `${Date.now()}`,
        }),
    });

    const data = await response.json();
    return data.data.id;
}

async function createInvoice(clientId) {
    const response = await fetch(`${BASE_URL}/invoices`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientId,
            items: [
                {
                    itemName: "Gold Coin",
                    quantity: 1,
                    unitValue: 50000,
                },
            ],
        }),
    });

    const data = await response.json();
    return data.data.id;
}

async function main() {
    console.log("Creating test data...");

    const clientId = await createClient();
    const invoiceId = await createInvoice(clientId);

    console.log("Invoice:", invoiceId);

    const requests = [];

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        requests.push(
            fetch(`${BASE_URL}/invoices/${invoiceId}/deliveries`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            })
        );
    }

    const responses = await Promise.all(requests);

    let success = 0;
    let conflict = 0;

    for (const response of responses) {
        if (response.status === 201) {
            success++;
        } else if (response.status === 409) {
            conflict++;
        }
    }

    console.log("\n===== RESULT =====");
    console.log("Successful deliveries :", success);
    console.log("Conflicts             :", conflict);

    if (success === 1 && conflict === TOTAL_REQUESTS - 1) {
        console.log("✅ Concurrency test PASSED");
    } else {
        console.log("❌ Concurrency test FAILED");
    }
}

main().catch(console.error);