import express from "express";
import { getPatientAppointments } from "../controllers/patient_controller.js";

const patient_router = express.Router();

patient_router.get("/get-patient-appointment", getPatientAppointments);

export default patient_router;
