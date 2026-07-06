const express = require('express');
require('dotenv/config');
const pool = require('./config/db.js');
const clientRoutes = require('./routes/client.route.js');
const invoiceRoutes = require('./routes/invoice.route.js');
const deliveryRoutes = require('./routes/delivery.route.js');

const app = express();

app.use(express.json());
app.use('/clients', clientRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/deliveries', deliveryRoutes);

app.get("/", (req, res) => {
    res.send("Server Running");
});


app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            success: true,
            message: "Database connected",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});


const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});