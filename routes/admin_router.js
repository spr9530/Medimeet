// routes/admin_router.js
import express from "express";
import {
  approvePayout,
  getPendingDoctors,
  getPendingPayouts,
  getVerifiedDoctors,
  suspendDoctor,
  updateDoctorStatus,
  verifyAdmin,
} from "../controllers/admin_controller.js";

const admin_router = express.Router();

// Admin check
admin_router.get("/verify", verifyAdmin);

// Doctors management
admin_router.get("/pending-doctors", getPendingDoctors);
admin_router.get("/verified-doctors", getVerifiedDoctors);
admin_router.put("/update-doctor-status", updateDoctorStatus);
admin_router.put("/update-doctor-status-suspend", suspendDoctor);


export default admin_router;
