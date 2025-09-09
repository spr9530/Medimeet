import express from 'express'
import { getDoctorEarnings, getPayouts, requestPayout } from '../controllers/payout_controller.js';
import { approvePayout, getPendingPayouts } from '../controllers/admin_controller.js';

const payout_router = express.Router();

payout_router.get('/get-payouts',getPayouts )
payout_router.get('/get-earnings', getDoctorEarnings)
payout_router.post("/request", requestPayout);
payout_router.get("/pending", getPendingPayouts)
payout_router.post("/approve", approvePayout);


export default payout_router;