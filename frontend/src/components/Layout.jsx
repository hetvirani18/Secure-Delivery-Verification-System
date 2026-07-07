import { NavLink, Outlet } from "react-router";

function navClass(isActive) {
	return [
		"text-sm font-medium transition-colors",
		isActive ? "text-slate-900 border-b-2 border-slate-900 pb-1" : "text-slate-500 hover:text-slate-900",
	].join(" ");
}

function Layout() {
	return (
		<div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
			{/* Simple, clean top header */}
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
					<div>
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-400">SecurePass</span>
						<h1 className="text-lg font-bold text-slate-900">Delivery Dashboard</h1>
					</div>
					
					{/* Minimalist text navigation */}
					<nav className="flex items-center gap-6">
						<NavLink className={({ isActive }) => navClass(isActive)} to="/">
							Board
						</NavLink>
						<NavLink className={({ isActive }) => navClass(isActive)} to="/run-delivery">
							Run Delivery
						</NavLink>
					</nav>
				</div>
			</header>

			{/* Main Content Viewport */}
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<Outlet />
			</main>
		</div>
	);
}

export default Layout;