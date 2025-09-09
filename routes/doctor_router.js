import express from "express";
import { getDoctorAppointments, getDoctorAvailability, getDoctorBySpeciality, getDoctorDetails, getDoctorSlots, setAvailability } from "../controllers/doctor_controller.js";
import { cancelAppointment } from "../controllers/appointment_controller.js";
const doctor_router = express.Router();

doctor_router.get("/get-detail", getDoctorDetails)
doctor_router.get("/get-available-timeslots", getDoctorSlots)
doctor_router.get("/speciality", getDoctorBySpeciality)
doctor_router.post("/set-availability", setAvailability)
doctor_router.get("/get-availability", getDoctorAvailability)
doctor_router.get("/get-appointment", getDoctorAppointments)



export default doctor_router;
