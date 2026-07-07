import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchDeliveries } from "../api";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageFrame } from "../components/Ui";
import { formatMoney, getStatusConfig } from "../utils/delivery";

function BoardPage() {
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                setLoading(true);
                const response = await fetchDeliveries();
                if (!active) return;
                setDeliveries(response.data || []);
            } catch (err) {
                if (!active) return;
                setError(err.response?.data?.message || err.message || "Failed to load deliveries");
            } finally {
                if (active) setLoading(false);
            }
        }

        load();

        return () => {
            active = false;
        };
    }, []);

    const columns = useMemo(() => {
        const grouped = {
            pending: [],
            progress: [],
            completed: [],
            failed: [],
        };

        for (const delivery of deliveries) {
            if (delivery.status === "PENDING") grouped.pending.push(delivery);
            else if (delivery.status === "IDENTIFIED" || delivery.status === "OTP_SENT") grouped.progress.push(delivery);
            else if (delivery.status === "COMPLETED") grouped.completed.push(delivery);
            else grouped.failed.push(delivery);
        }

        return [
            { key: "pending", title: "Pending", helper: "Waiting", items: grouped.pending },
            { key: "progress", title: "In Progress", helper: "Active", items: grouped.progress },
            { key: "completed", title: "Completed", helper: "Successful", items: grouped.completed },
            { key: "failed", title: "Failed", helper: "Needs attention", items: grouped.failed },
        ];
    }, [deliveries]);

    return (
        /* FIX: Changed from <div> to <PageFrame> so the header metadata actually renders */
        <PageFrame
            eyebrow="Overview"
            title="Delivery Board"
            description="A real-time Kanban board mapping backend delivery status states."
            actions={[
                <button 
                    key="refresh" 
                    onClick={() => window.location.reload()} 
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                    Refresh
                </button>,
            ]}
        >
            {loading && <LoadingState label="Loading board data..." />}
            {error && <ErrorState message={error} />}
            
            {!loading && !error && (
                <div className="grid gap-4 xl:grid-cols-4">
                    {columns.map((column) => (
                        <Card key={column.key} className="bg-slate-50/50 p-4 border border-slate-200">
                            {/* Column Header */}
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200/65 pb-2">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">{column.title}</h3>
                                    <p className="text-xs text-slate-400">{column.helper}</p>
                                </div>
                                <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                                    {column.items.length}
                                </span>
                            </div>

                            {/* Cards Stack */}
                            <div className="space-y-3">
                                {column.items.length === 0 && <EmptyState small message="No deliveries" />}
                                
                                {column.items.map((delivery) => {
                                    const statusConfig = getStatusConfig(delivery.status);

                                    return (
                                        <Link 
                                            key={delivery.id} 
                                            to={`/deliveries/${delivery.id}`} 
                                            className={`block rounded border ${statusConfig.card || 'border-slate-200'} bg-white p-3 shadow-sm transition hover:border-slate-400`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">#{delivery.invoiceNumber}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{delivery.clientName}</p>
                                                </div>
                                                <Badge status={statusConfig.label} tone={statusConfig.badge} />
                                            </div>

                                            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                                                <p><span className="font-medium text-slate-400">Value:</span> {formatMoney(delivery.totalValue)}</p>
                                                <p><span className="font-medium text-slate-400">Attempts:</span> ID ({delivery.identifyAttempts}) • OTP ({delivery.otpAttempts})</p>
                                                
                                                {delivery.latestEvent && (
                                                    <p className="mt-1 truncate rounded bg-slate-50 p-1 text-[10px] text-slate-600">
                                                        {delivery.latestEvent.description || delivery.latestEvent.type}
                                                    </p>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </PageFrame>
    );
}

export default BoardPage;