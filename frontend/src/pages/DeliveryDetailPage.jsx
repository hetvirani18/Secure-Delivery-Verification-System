import { Link, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchDeliveries, fetchDeliveryHistory } from "../api";
import { Badge, Card, EmptyState, ErrorState, InfoTile, LoadingState, PageFrame } from "../components/Ui";
import { buildTimeline, formatDate, getStatusConfig } from "../utils/delivery";

function DeliveryDetailPage() {
    const { deliveryId } = useParams();
    const [delivery, setDelivery] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                setLoading(true);
                const [deliveriesResponse, historyResponse] = await Promise.all([
                    fetchDeliveries(),
                    fetchDeliveryHistory(deliveryId),
                ]);

                if (!active) return;
                setDelivery((deliveriesResponse.data || []).find((item) => String(item.id) === String(deliveryId)) || null);
                setHistory(historyResponse.data?.history || []);
            } catch (err) {
                if (!active) return;
                setError(err.response?.data?.message || err.message || "Failed to load delivery history");
            } finally {
                if (active) setLoading(false);
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [deliveryId]);

    const timeline = useMemo(() => buildTimeline(history), [history]);
    const statusConfig = getStatusConfig(delivery?.status || "PENDING");

    return (
        <PageFrame
            eyebrow="System Logs"
            title={delivery ? `Delivery #${delivery.id}` : `Delivery #${deliveryId}`}
            description="Audit trail mapping raw system states, verification attempts, and timing snapshots."
            actions={[
                <Link 
                    key="back" 
                    to="/" 
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                    Back to Board
                </Link>,
            ]}
        >
            {loading && <LoadingState label="Fetching details..." />}
            {error && <ErrorState message={error} />}
            
            {!loading && !error && (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    
                    {/* Left: Metadata Overview */}
                    <Card className="border border-slate-200 p-5 bg-white">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <span className="text-xs uppercase font-medium tracking-wider text-slate-400">Record Schema</span>
                                <h3 className="mt-0.5 text-xl font-bold text-slate-900">#{delivery?.invoiceNumber || `Delivery ${deliveryId}`}</h3>
                                <p className="mt-1 text-xs text-slate-600 font-medium">Client Object: <span className="text-slate-900 font-semibold">{delivery?.clientName || "Unknown"}</span></p>
                            </div>
                            <Badge status={statusConfig.label} tone={statusConfig.badge} />
                        </div>
                        
                        {/* Data Grid Attributes */}
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <InfoTile label="Receiver Identity" value={delivery?.receiverName || "Not assigned"} />
                            <InfoTile label="Invoice Status" value={delivery?.invoiceStatus || "—"} />
                            <InfoTile label="Attempt Vectors" value={`Identify (${delivery?.identifyAttempts ?? 0}) • OTP (${delivery?.otpAttempts ?? 0})`} />
                            <InfoTile label="Timestamp Completed" value={formatDate(delivery?.completedAt) || "Unresolved"} />
                        </div>
                    </Card>

                    {/* Right: Technical Audit Timeline */}
                    <Card className="border border-slate-200 p-5 bg-white">
                        <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase mb-4">State Machine Lifecycle</h3>
                        <div className="relative border-l border-slate-200 pl-4 space-y-4">
                            {timeline.length === 0 && <EmptyState small message="No state history found." />}
                            
                            {timeline.map((entry) => (
                                <div key={entry.key} className="relative">
                                    <div className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-slate-400" />
                                    
                                    <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                                        <p className="text-xs font-bold text-slate-900">{entry.title}</p>
                                        {entry.description && (
                                            <p className="mt-1 text-xs text-slate-500 font-medium">{entry.description}</p>
                                        )}
                                        {entry.details && entry.details.length > 0 && (
                                            <div className="mt-2 space-y-0.5">
                                                {entry.details.map((detail) => (
                                                    <p key={detail.label} className="text-[10px] text-slate-400 font-mono">
                                                        <span className="text-slate-500 font-semibold">{detail.label}:</span>{" "}
                                                        {detail.isLink ? (
                                                            <a
                                                                href={detail.value}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sky-500 underline hover:text-sky-700"
                                                            >
                                                                View on Maps
                                                            </a>
                                                        ) : (
                                                            detail.value
                                                        )}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                        <p className="mt-1.5 text-[10px] text-slate-400 font-mono">{formatDate(entry.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
        </PageFrame>
    );
}

export default DeliveryDetailPage;