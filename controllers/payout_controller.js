import User from "../models/user_model.js";
import Payout from "../models/payout_model.js";
import Appointment from "../models/appointment_model.js";


const CREDIT_VALUE = 1; // example: $10 per credit
const PLATFORM_FEE_PER_CREDIT = .2;
const DOCTOR_EARNINGS_PER_CREDIT = .8; 

export const getPayouts = async (req, res) => {
  const { userId } = req.query;

  try {
    const doctor = await User.findOne({
      clerkUserId: userId,
      role: "doctor",
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    const payouts = await Payout.find({ doctorId: doctor._id })
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json({ payouts });
  } catch (error) {
    console.error("Error fetching payouts:", error.message);
    return res.status(500).json({ message: "Failed to fetch payouts", error: error.message });
  }
};

export const getDoctorEarnings = async (req, res) => {
  const { userId } = req.query;

  try {
    const doctor = await User.findOne({
      clerkUserId: userId,
      role: "doctor",
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Get all completed appointments
    const completedAppointments = await Appointment.find({
      doctorId: doctor._id,
      status: "completed",
    }).exec();

    // Filter for current month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const thisMonthAppointments = completedAppointments.filter(
      (appointment) => new Date(appointment.createdAt) >= currentMonth
    );

    // Calculate earnings
    const totalEarnings = doctor.credits * DOCTOR_EARNINGS_PER_CREDIT;
    const thisMonthEarnings =
      thisMonthAppointments.length * 2 * DOCTOR_EARNINGS_PER_CREDIT;

    const averageEarningsPerMonth =
      totalEarnings > 0
        ? totalEarnings / Math.max(1, new Date().getMonth() + 1)
        : 0;

    const availableCredits = doctor.credits;
    const availablePayout = availableCredits * DOCTOR_EARNINGS_PER_CREDIT;

    return res.status(200).json({
      earnings: {
        totalEarnings,
        thisMonthEarnings,
        completedAppointments: completedAppointments.length,
        averageEarningsPerMonth,
        availableCredits,
        availablePayout,
      },
    });
  } catch (error) {
    console.error("Error fetching doctor earnings:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to fetch doctor earnings", error: error.message });
  }
};

export const requestPayout = async (req, res) => {
  const { userId, paypalEmail } = req.body;

  try {
    const doctor = await User.findOne({
      clerkUserId: userId,
      role: "doctor",
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (!paypalEmail) {
      return res.status(400).json({ message: "PayPal email is required" });
    }

    // Check for existing pending payout
    const existingPendingPayout = await Payout.findOne({
      doctorId: doctor._id,
      status: "PROCESSING",
    });

    if (existingPendingPayout) {
      return res.status(400).json({
        message:
          "You already have a pending payout request. Please wait for it to be processed.",
      });
    }

    const creditCount = doctor.credits;

    if (creditCount < 1) {
      return res
        .status(400)
        .json({ message: "Minimum 1 credit required for payout" });
    }

    // Calculate amounts
    const totalAmount = creditCount * CREDIT_VALUE;
    const platformFee = creditCount * PLATFORM_FEE_PER_CREDIT;
    const netAmount = creditCount * DOCTOR_EARNINGS_PER_CREDIT;

    // Create payout request
    const payout = await Payout.create({
      doctorId: doctor._id,
      amount: totalAmount,
      credits: creditCount,
      platformFee,
      netAmount,
      paypalEmail,
      status: "PROCESSING",
    });

    return res.status(201).json({ success: true, payout });
  } catch (error) {
    console.error("Failed to request payout:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to request payout", error: error.message });
  }
};
