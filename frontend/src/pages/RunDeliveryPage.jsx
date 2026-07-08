import { useEffect, useMemo, useRef, useState } from "react";
import { createDelivery, fetchClientReceivers, fetchInvoices, identifyDelivery, sendOtp, verifyOtp } from "../api";
import { Card, EmptyState, ErrorState, LoadingState, PageFrame, StepPill, SuccessState } from "../components/Ui";
import { formatMoney, stageConfig } from "../utils/delivery";

function RunDeliveryPage() {
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
    const [activeDelivery, setActiveDelivery] = useState(null);
    const [receivers, setReceivers] = useState([]);
    const [selectedReceiver, setSelectedReceiver] = useState(null);
    const [similarity, setSimilarity] = useState(92);
    const [otp, setOtp] = useState("");
    const [currentOtp, setCurrentOtp] = useState(null);
    const [currentDuressOtp, setCurrentDuressOtp] = useState(null);
    const [showingDuress, setShowingDuress] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const longPressTimer = useRef(null);

    useEffect(() => {
        let active = true;
        async function load() {
            try {
                setLoading(true);
                const response = await fetchInvoices();
                if (!active) return;
                setInvoices(response.data || []);
            } catch (err) {
                if (!active) return;
                setError(err.response?.data?.message || err.message || "Failed to load invoices");
            } finally {
                if (active) setLoading(false);
            }
        }
        load();
        return () => { active = false; };
    }, []);

    const readyInvoices = useMemo(
        () => invoices.filter(
            (invoice) =>
                invoice.status === "PENDING" &&
                (!invoice.latestDelivery || invoice.latestDelivery.status === "FAILED")
        ),
        [invoices]
    );

    async function handleStartDelivery() {
        if (!selectedInvoiceId) return;
        try {
            setBusy(true);
            setError("");
            setMessage("");
            setCurrentOtp(null);
            setCurrentDuressOtp(null);
            setShowingDuress(false);
            setOtp("");
            setSelectedReceiver(null);
            setReceivers([]);

            const invoice = readyInvoices.find((i) => String(i.id) === String(selectedInvoiceId));
            const [deliveryResponse, receiversResponse] = await Promise.all([
                createDelivery(selectedInvoiceId),
                invoice?.clientId ? fetchClientReceivers(invoice.clientId) : Promise.resolve({ data: [] }),
            ]);

            setActiveDelivery(deliveryResponse.data);
            setReceivers(receiversResponse.data || []);
            setMessage(`Delivery ${deliveryResponse.data.id} started. Select a receiver below.`);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to start delivery");
        } finally {
            setBusy(false);
        }
    }

    async function handleIdentify() {
        if (!activeDelivery || !selectedReceiver) return;
        try {
            setBusy(true);
            setError("");
            setMessage("");
            const response = await identifyDelivery(activeDelivery.id, {
                receiverId: selectedReceiver.id,
                similarity: Number(similarity),
            });
            setActiveDelivery((current) => ({ ...(current || {}), status: response.data.status }));
            setMessage(`Receiver identified (score: ${similarity}).`);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to identify receiver");
        } finally {
            setBusy(false);
        }
    }

    async function handleSendOtp() {
        if (!activeDelivery) return;
        try {
            setBusy(true);
            setError("");
            setMessage("");
            setShowingDuress(false);
            setOtp("");
            const response = await sendOtp(activeDelivery.id);
            setActiveDelivery((current) => ({ ...(current || {}), status: response.data.status }));
            setCurrentOtp(response.data.otp);
            setCurrentDuressOtp(response.data.duressOtp);
            setMessage("OTP ready. Tap to reveal, hold 2s for duress code.");
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to send OTP");
        } finally {
            setBusy(false);
        }
    }

    async function handleVerifyOtp() {
        if (!activeDelivery) return;
        try {
            setBusy(true);
            setError("");
            setMessage("");

            let latitude = null;
            let longitude = null;
            if (navigator.geolocation) {
                try {
                    const position = await new Promise((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 0 })
                    );
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                } catch {
                    // GPS denied — proceed without
                }
            }

            const response = await verifyOtp(activeDelivery.id, otp, latitude, longitude);
            setActiveDelivery((current) => ({ ...(current || {}), status: response.data.status }));
            setCurrentOtp(null);
            setCurrentDuressOtp(null);
            setShowingDuress(false);
            setOtp("");
            setMessage("Verification successful. Delivery completed.");
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to verify OTP");
        } finally {
            setBusy(false);
        }
    }

    function handleOtpPressStart() {
        longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            setShowingDuress(true);
            setOtp(currentDuressOtp || "");
        }, 2000);
    }

    function handleOtpPressEnd() {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            setShowingDuress(false);
            setOtp(currentOtp || "");
        }
    }

    const currentStage = activeDelivery?.status || "PENDING";
    const hasOtp = Boolean(currentOtp);

    return (
        <PageFrame
            eyebrow="Workflow Sandbox"
            title="Run Delivery"
            description="Walk a delivery through identify → OTP → completed."
        >
            {loading && <LoadingState label="Loading invoices..." />}
            {error && <ErrorState message={error} />}
            {message && <SuccessState message={message} />}

            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

                {/* Section 1: Invoice Selection */}
                <Card className="border border-slate-200 p-5 bg-white">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">1. Select Invoice</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Only PENDING invoices with no active delivery shown</p>
                        </div>

                        <select
                            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-900"
                            value={selectedInvoiceId}
                            onChange={(event) => setSelectedInvoiceId(event.target.value)}
                        >
                            <option value="">Select invoice...</option>
                            {readyInvoices.map((invoice) => (
                                <option key={invoice.id} value={invoice.id}>
                                    {invoice.invoiceNumber} · {invoice.clientName} · {formatMoney(invoice.totalValue)}
                                </option>
                            ))}
                        </select>

                        <button
                            disabled={!selectedInvoiceId || busy}
                            onClick={handleStartDelivery}
                            className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Start Delivery
                        </button>

                        {readyInvoices.length === 0 && !loading && (
                            <EmptyState small message="No eligible invoices found." />
                        )}

                        {/* Receiver Picker */}
                        {receivers.length > 0 && (
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                                <p className="text-xs font-semibold text-slate-700">Select Receiver</p>
                                <div className="grid gap-2">
                                    {receivers.map((r) => (
                                        <button
                                            key={r.id}
                                            onClick={() => setSelectedReceiver(r)}
                                            className={`flex items-center gap-3 rounded border px-3 py-2 text-left transition ${
                                                selectedReceiver?.id === r.id
                                                    ? "border-slate-900 bg-slate-900 text-white"
                                                    : "border-slate-200 bg-white hover:border-slate-400"
                                            }`}
                                        >
                                            <img
                                                src={r.photoUrl}
                                                alt={r.name}
                                                className="h-10 w-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                                                onError={(e) => {
                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=e2e8f0&color=475569`;
                                                }}
                                            />
                                            <div className="min-w-0">
                                                <p className={`text-xs font-semibold truncate ${selectedReceiver?.id === r.id ? "text-white" : "text-slate-900"}`}>
                                                    {r.name}
                                                </p>
                                                <p className={`text-[10px] truncate ${selectedReceiver?.id === r.id ? "text-slate-300" : "text-slate-400"}`}>
                                                    {r.phone}
                                                </p>
                                            </div>
                                            {selectedReceiver?.id === r.id && (
                                                <span className="ml-auto text-[10px] font-bold text-emerald-400">✓ Selected</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Section 2: Delivery Steps */}
                <Card className="border border-slate-200 p-5 bg-white">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">2. Delivery Steps</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Identify → OTP → Complete</p>
                        </div>

                        <StepPill label="Current State" value={stageConfig[currentStage]?.label || currentStage} />

                        {/* Similarity Slider */}
                        {activeDelivery && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-500">
                                    <span>Face Match Score</span>
                                    <span className={`font-bold ${Number(similarity) >= 85 ? "text-emerald-600" : "text-rose-500"}`}>
                                        {similarity}% {Number(similarity) >= 85 ? "✓ Pass" : "✗ Fail"}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={similarity}
                                    onChange={(e) => setSimilarity(e.target.value)}
                                    className="w-full accent-slate-900"
                                />
                            </div>
                        )}

                        <div className="space-y-2 border-t border-slate-100 pt-3">
                            <button
                                disabled={!activeDelivery || !selectedReceiver || busy}
                                onClick={handleIdentify}
                                className="w-full text-left rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Step A — Identify Receiver
                                {selectedReceiver && (
                                    <span className="ml-2 text-slate-400 font-normal">({selectedReceiver.name})</span>
                                )}
                            </button>

                            <button
                                disabled={!activeDelivery || busy}
                                onClick={handleSendOtp}
                                className="w-full text-left rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Step B — Generate OTP
                            </button>
                        </div>

                        {/* OTP Reveal */}
                        {hasOtp && (
                            <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                    Tap to reveal · hold 2s for duress code
                                </p>
                                <button
                                    onMouseDown={handleOtpPressStart}
                                    onMouseUp={handleOtpPressEnd}
                                    onMouseLeave={handleOtpPressEnd}
                                    onTouchStart={handleOtpPressStart}
                                    onTouchEnd={handleOtpPressEnd}
                                    className="w-full rounded border border-slate-300 bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-slate-900 select-none transition hover:bg-slate-50 active:bg-slate-100"
                                >
                                    {otp || "· · · · · ·"}
                                </button>
                                {showingDuress && (
                                    <p className="text-[10px] font-semibold text-rose-500 text-center">
                                        🚨 Duress code active — silent alarm will trigger on submit
                                    </p>
                                )}
                            </div>
                        )}

                        {/* OTP Verify */}
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] border-t border-slate-100 pt-3">
                            <input
                                value={otp}
                                onChange={(event) => setOtp(event.target.value)}
                                placeholder="Enter OTP"
                                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-900"
                            />
                            <button
                                disabled={!activeDelivery || busy}
                                onClick={handleVerifyOtp}
                                className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Verify OTP
                            </button>
                        </div>

                        {activeDelivery && (
                            <div className="rounded border border-slate-200 bg-slate-50/70 p-3 font-mono text-[10px] text-slate-600 space-y-0.5">
                                <p className="font-bold text-slate-900 mb-1">State:</p>
                                <p>delivery_id : {activeDelivery.id}</p>
                                <p>invoice_id  : {activeDelivery.invoiceId}</p>
                                <p>status      : {activeDelivery.status}</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </PageFrame>
    );
}

export default RunDeliveryPage;
