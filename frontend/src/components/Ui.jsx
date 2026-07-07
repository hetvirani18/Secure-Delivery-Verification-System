function PageFrame({ eyebrow, title, description, children, actions }) {
	return (
		<section className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="max-w-3xl space-y-3">
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{eyebrow}</p>
					<h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
					<p className="text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
				</div>
				{actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
			</div>
			{children}
		</section>
	);
}

function Card({ children, className = "" }) {
	return <div className={`rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ${className}`}>{children}</div>;
}

function Badge({ status, tone }) {
	return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tone}`}>{status}</span>;
}

function LoadingState({ label }) {
	return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">{label}...</div>;
}

function ErrorState({ message }) {
	return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{message}</div>;
}

function SuccessState({ message }) {
	return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>;
}

function EmptyState({ message, small = false }) {
	return <div className={`rounded-2xl border border-dashed border-slate-300 ${small ? "p-3 text-xs" : "p-5 text-sm"} text-slate-500`}>{message}</div>;
}

function InfoTile({ label, value }) {
	return (
		<div className="rounded-2xl bg-slate-50 p-4">
			<p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
			<p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
		</div>
	);
}

function StepPill({ label, value }) {
	return (
		<div className="flex border border-slate-300 items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
			<span className="text-xs uppercase tracking-[0.2em] text-slate-700">{label}</span>
			<span className="text-sm font-semibold">{value}</span>
		</div>
	);
}

function Field({ label, value, onChange, placeholder }) {
	return (
		<label className="space-y-2 text-sm">
			<span className="block font-medium text-slate-700">{label}</span>
			<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-950" />
		</label>
	);
}

export {
	PageFrame,
	Card,
	Badge,
	LoadingState,
	ErrorState,
	SuccessState,
	EmptyState,
	InfoTile,
	StepPill,
	Field,
};
