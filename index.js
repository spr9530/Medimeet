import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDb from "./config/db-config.js"; 
import user_router from "./routes/user_routes.js";
import credit_router from "./routes/credit_router.js";
import bodyParser from "body-parser";
import admin_router from "./routes/admin_router.js";
import doctor_router from "./routes/doctor_router.js";
import appointment_router from "./routes/appointment_router.js";
import patient_router from "./routes/patient_router.js";
import payout_router from "./routes/payout_router.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

connectDb()


// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); 
app.use("/api/user", user_router);
app.use("/api/credits", credit_router);
app.use("/api/admin", admin_router);
app.use("/api/doctor", doctor_router);
app.use("/api/appointments", appointment_router)
app.use("/api/patient", patient_router)
app.use("/api/payout", payout_router)


// Test route
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});


    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
