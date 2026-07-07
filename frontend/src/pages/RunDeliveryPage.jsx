import { useEffect, useMemo, useRef, useState } from "react";
import { createDelivery, fetchInvoices, identifyDelivery, sendOtp, verifyOtp } from "../api";
import { Card, EmptyState, ErrorState, Field, LoadingState, PageFrame, StepPill, SuccessState } from "../components/Ui";
import { formatMoney, stageConfig } from "../utils/delivery";

function RunDeliveryPage() {
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
    const [activeDelivery, setActiveDelivery] = useState(null);
    const [receiverId, setReceiverId] = useState("");
    const [similarity, setSimilarity] = useState("92");
    const [otp, setOtp] = useState("");
    const [currentOtp, setCurrentOtp] = useState(null);
    const [currentDuressOtp, setCurrentDuressOtp] = useState(null);
    const [showingDuress, setShowingDuress] = useState(false);
    const [otpRevealed, setOtpRevealed] = useState(false);
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
            const response = await createDelivery(selectedInvoiceId);
            setActiveDelivery(response.data);
            setMessage(`Delivery ${response.data.id} started.`);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to start delivery");
        } finally {
            setBusy(false);
        }
    }

    async function handleIdentify() {
        if (!activeDelivery) return;
        try {
            setBusy(true);
            setError("");
            setMessage("");
            const response = await identifyDelivery(activeDelivery.id, {
                receiverId: Number(receiverId),
                similarity: Number(similarity),
            });
            setActiveDelivery((current) => ({ ...(current || {}), status: response.data.status }));
            setMessage(`Receiver identified (${response.data.status}).`);
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
            setMessage("OTP ready. Tap the code button to reveal, or hold 2s to reveal duress code.");
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
            const response = await verifyOtp(activeDelivery.id, otp);
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

    // Hold 2s → fill duress OTP. Short tap → fill real OTP.
    function handleOtpPressStart() {
        // Reset any previous duress state when press starts
        longPressTimer.current = setTimeout(() => {
            // Long press completed — fill duress OTP and mark it
            longPressTimer.current = null;
            setShowingDuress(true);
            setOtp(currentDuressOtp || "");
        }, 2000);
    }

    function handleOtpPressEnd() {
        if (longPressTimer.current) {
            // Timer still running = short tap, never reached 2s
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            // Short tap → fill real OTP
            setShowingDuress(false);
            setOtp(currentOtp || "");
        }
        // If timer already fired (long press), do nothing here —
        // duress OTP is already in the input from the timeout callback
    }

    const currentStage = activeDelivery?.status || "PENDING";
    const hasOtp = Boolean(currentOtp);

    return (
        <PageFrame
            eyebrow="Workflow Sandbox"
            title="Execution Pipeline"
            description="Step-by-step state engine simulator to verify back-end transaction triggers."
        >
            {loading && <LoadingState label="Loading schema dependencies..." />}
            {error && <ErrorState message={error} />}
            {message && <SuccessState message={message} />}

            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

                {/* Section 1: Target Selection */}
                <Card className="border border-slate-200 p-5 bg-white">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">1. Target Selection</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Filter criteria: Status == PENDING &amp;&amp; ActiveDelivery == NULL</p>
                        </div>

                        <select
                            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-900"
                            value={selectedInvoiceId}
                            onChange={(event) => setSelectedInvoiceId(event.target.value)}
                        >
                            <option value="">Select Target Invoice...</option>
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
                            Initialize State Engine
                        </button>

                        {readyInvoices.length === 0 && <EmptyState small message="No test entries match entry parameters." />}
                    </div>
                </Card>

                {/* Section 2: Transaction Execution */}
                <Card className="border border-slate-200 p-5 bg-white">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">2. Transaction Execution</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Step-by-step state verification steps.</p>
                        </div>

                        <StepPill label="Active State" value={stageConfig[currentStage]?.label || currentStage} />

                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                            <Field label="Receiver PK" value={receiverId} onChange={setReceiverId} placeholder="e.g. 104" />
                            <Field label="Match Confidence %" value={similarity} onChange={setSimilarity} placeholder="0-100" />
                        </div>

                        <div className="space-y-2 border-t border-slate-100 pt-3">
                            <button
                                disabled={!activeDelivery || busy}
                                onClick={handleIdentify}
                                className="w-full text-left rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Step A — Identify Receiver
                            </button>

                            <button
                                disabled={!activeDelivery || busy}
                                onClick={handleSendOtp}
                                className="w-full text-left rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Step B — Generate OTP
                            </button>
                        </div>

                        {/* OTP Reveal button — tap for real OTP, hold 2s for duress OTP */}
                        {hasOtp && (
                            <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                    Receiver screen — tap to reveal · hold 2s for duress code
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
                                <p className="font-bold text-slate-900 mb-1">State Context:</p>
                                <p>delivery_id : {activeDelivery.id}</p>
                                <p>invoice_id  : {activeDelivery.invoiceId}</p>
                                <p>state_key   : {activeDelivery.status}</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </PageFrame>
    );
}

export default RunDeliveryPage;
