import axios from "axios";

const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

export function fetchDeliveries() {
	return api.get("/deliveries").then((response) => response.data);
}

export function fetchDeliveryHistory(deliveryId) {
	return api.get(`/deliveries/${deliveryId}/history`).then((response) => response.data);
}

export function fetchInvoices() {
	return api.get("/invoices").then((response) => response.data);
}

export function createDelivery(invoiceId) {
	return api.post(`/invoices/${invoiceId}/deliveries`).then((response) => response.data);
}

export function identifyDelivery(deliveryId, payload) {
	return api
		.post(`/deliveries/${deliveryId}/identify`, payload)
		.then((response) => response.data);
}

export function sendOtp(deliveryId) {
	return api.post(`/deliveries/${deliveryId}/send-otp`).then((response) => response.data);
}

export function verifyOtp(deliveryId, otp, latitude, longitude) {
	return api
		.post(`/deliveries/${deliveryId}/verify-otp`, { otp, latitude, longitude })
		.then((response) => response.data);
}

export function fetchClientReceivers(clientId) {
	return api.get(`/clients/${clientId}/receivers`).then((response) => response.data);
}

export function fetchClients() {
	return api.get("/clients").then((response) => response.data);
}

export function fetchClientSummary(clientId) {
	return api.get(`/clients/${clientId}/summary`).then((response) => response.data);
}
