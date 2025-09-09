import express from "express";
import { checkAndAllocateCredits, deductCreditsForAppointment } from "../controllers/credit_controller.js";


const credit_router = express.Router();

credit_router.post("/allocate", checkAndAllocateCredits);
credit_router.post("/deduct", deductCreditsForAppointment);

export default credit_router;
