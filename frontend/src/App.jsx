import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import BoardPage from "./pages/BoardPage";
import DeliveryDetailPage from "./pages/DeliveryDetailPage";
import RunDeliveryPage from "./pages/RunDeliveryPage";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Layout />}>
					<Route index element={<BoardPage />} />
					<Route path="deliveries/:deliveryId" element={<DeliveryDetailPage />} />
					<Route path="run-delivery" element={<RunDeliveryPage />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

export default App;