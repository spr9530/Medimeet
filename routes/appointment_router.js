import express from "express"
import { addAppointmentNotes, bookAppointment, cancelAppointment, generateVideoToken, markAppointmentCompleted } from "../controllers/appointment_controller.js";

const appointment_router = express.Router();

appointment_router.post('/book', bookAppointment)
appointment_router.post("/cancel-appointment", cancelAppointment)
appointment_router.post("/add-notes-to-appointment", addAppointmentNotes)
appointment_router.post("/mark-appointment-complete", markAppointmentCompleted)
appointment_router.post("/genrate-video-token", generateVideoToken)




export default appointment_router