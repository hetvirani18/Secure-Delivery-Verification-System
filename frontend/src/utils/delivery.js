export const stageConfig = {
	PENDING: { label: "Pending", badge: "bg-amber-100 text-amber-800 ring-amber-200", card: "border-amber-200" },
	IDENTIFIED: { label: "In progress", badge: "bg-sky-100 text-sky-800 ring-sky-200", card: "border-sky-200" },
	OTP_SENT: { label: "In progress", badge: "bg-indigo-100 text-indigo-800 ring-indigo-200", card: "border-indigo-200" },
	COMPLETED: { label: "Completed", badge: "bg-emerald-100 text-emerald-800 ring-emerald-200", card: "border-emerald-200" },
	FAILED: { label: "Failed", badge: "bg-rose-100 text-rose-800 ring-rose-200", card: "border-rose-200" },
};

export function formatMoney(value) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2,
	}).format(Number(value || 0));
}

export function formatDate(value) {
	if (!value) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function safeJson(value) {
	if (!value) return null;
	if (typeof value === "object") return value;
	if (typeof value !== "string") return value;

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

export function getStatusConfig(status) {
	return stageConfig[status] || stageConfig.PENDING;
}

export function buildTimeline(history) {
	let identifyAttempt = 0;
	let otpAttempt = 0;

	return history.map((event, index) => {
		const metadata = safeJson(event.metadata) || {};
		let title = event.description || event.eventType;
		let description = "";

		if (event.eventType === "IDENTIFY_FAILED") {
			identifyAttempt += 1;
			title = `Identify attempt ${identifyAttempt} — score ${metadata.similarity ?? "—"} — rejected`;
			description = metadata.reason || event.description || "Receiver check failed";
		} else if (event.eventType === "IDENTIFY_SUCCESS") {
			identifyAttempt += 1;
			title = `Identify attempt ${identifyAttempt} — score ${metadata.similarity ?? "—"} — accepted`;
			description = event.description || "Receiver accepted";
		} else if (event.eventType === "OTP_SENT") {
			title = "OTP sent";
			description = metadata.expiresAt ? `Expires at ${formatDate(metadata.expiresAt)}` : event.description || "OTP generated";
		} else if (event.eventType === "OTP_FAILED") {
			otpAttempt += 1;
			title = metadata.reason === "OTP expired" ? "OTP expired" : `OTP attempt ${otpAttempt} — rejected`;
			description = metadata.reason || event.description || "OTP verification failed";
		} else if (event.eventType === "OTP_VERIFIED") {
			title = "OTP verified successfully";
			description = event.description || "OTP matched";
		} else if (event.eventType === "DELIVERY_COMPLETED") {
			title = "Delivery completed";
			description = event.description || "Delivery closed successfully";
		} else if (event.eventType === "DELIVERY_CREATED") {
			title = "Delivery started";
			description = event.description || "Delivery row created";
		}

		return {
			key: `${event.eventType}-${index}`,
			title,
			description,
			createdAt: event.createdAt,
		};
	});
}
