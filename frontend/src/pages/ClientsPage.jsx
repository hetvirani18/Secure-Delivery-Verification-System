import { useEffect, useState } from "react";
import { fetchClients, fetchClientSummary } from "../api";
import { Badge, Card, EmptyState, ErrorState, InfoTile, LoadingState, PageFrame } from "../components/Ui";
import { formatMoney } from "../utils/delivery";

function ClientsPage() {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        async function load() {
            try {
                setLoadingClients(true);
                const response = await fetchClients();
                if (!active) return;
                setClients(response.data || []);
            } catch (err) {
                if (!active) return;
                setError(err.response?.data?.message || err.message || "Failed to load clients");
            } finally {
                if (active) setLoadingClients(false);
            }
        }
        load();
        return () => { active = false; };
    }, []);

    async function handleSelectClient(client) {
        try {
            setSelectedClient(client);
            setSummary(null);
            setLoadingSummary(true);
            setError("");
            const response = await fetchClientSummary(client.id);
            setSummary(response.data);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to load summary");
        } finally {
            setLoadingSummary(false);
        }
    }

    const statusBadges = summary
        ? [
              { label: "Delivered", count: summary.deliveredCount, tone: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
              { label: "Pending", count: summary.pendingCount, tone: "bg-amber-100 text-amber-800 ring-amber-200" },
              { label: "Failed", count: summary.failedCount, tone: "bg-rose-100 text-rose-800 ring-rose-200" },
          ]
        : [];

    return (
        <PageFrame
            eyebrow="Clients"
            title="Client Summary"
            description="Select a client to view their invoice and delivery statistics."
        >
            {error && <ErrorState message={error} />}

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

                {/* Left — client list */}
                <div className="space-y-2">
                    {loadingClients && <LoadingState label="Loading clients" />}
                    {!loadingClients && clients.length === 0 && (
                        <EmptyState message="No clients found." />
                    )}
                    {clients.map((client) => (
                        <button
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                selectedClient?.id === client.id
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                        >
                            <p className={`text-sm font-semibold ${selectedClient?.id === client.id ? "text-white" : "text-slate-900"}`}>
                                {client.name}
                            </p>
                            <p className={`text-xs mt-0.5 ${selectedClient?.id === client.id ? "text-slate-300" : "text-slate-400"}`}>
                                {client.phone}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Right — summary panel */}
                <div>
                    {!selectedClient && !loadingClients && (
                        <EmptyState message="Select a client on the left to view their summary." />
                    )}

                    {loadingSummary && <LoadingState label="Loading summary" />}

                    {summary && !loadingSummary && (
                        <Card className="border border-slate-200 p-5 bg-white space-y-5">

                            {/* Header */}
                            <div className="border-b border-slate-100 pb-4">
                                <p className="text-xs uppercase tracking-widest text-slate-400">Client Summary</p>
                                <h3 className="mt-1 text-2xl font-bold text-slate-900">{summary.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{summary.phone}</p>
                            </div>

                            {/* Status badges */}
                            <div className="flex flex-wrap gap-2">
                                {statusBadges.map((b) => (
                                    <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${b.tone}`}>
                                        {b.label} <span className="font-bold">{b.count}</span>
                                    </span>
                                ))}
                            </div>

                            {/* Stats grid */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoTile
                                    label="Total Invoices"
                                    value={summary.totalInvoices}
                                />
                                <InfoTile
                                    label="Total Delivered Value"
                                    value={formatMoney(summary.totalDeliveredValue)}
                                />
                            </div>

                            {/* Top receiver */}
                            {summary.topReceiver ? (
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Top Receiver</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-slate-900">{summary.topReceiver.name}</p>
                                        <Badge
                                            status={`${summary.topReceiver.deliveryCount} deliveries`}
                                            tone="bg-sky-100 text-sky-800 ring-sky-200"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <EmptyState small message="No completed deliveries yet — top receiver not available." />
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </PageFrame>
    );
}

export default ClientsPage;
