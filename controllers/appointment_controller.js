import User from "../models/user_model.js";
import Appointment from "../models/appointment_model.js"; // Mongoose Appointment model
import mongoose from "mongoose";
import CreditTransaction from "../models/creditTransaction_model.js";
import dotenv from "dotenv";
import { deductCreditsForAppointment } from "./credit_controller.js";

dotenv.config();
import { v4 as uuidv4 } from "uuid";

// const privateKeyPath = path.resolve(process.cwd(), process.env.VONAGE_PRIVATE_KEY_PATH);

// const vonage = new Vonage({
//   applicationId: process.env.VONAGE_APPLICATION_ID,
//   privateKey: privateKeyPath,
// });

// const credentials = new Auth({
//     applicationId: process.env.VONAGE_APPLICATION_ID,
//     privateKey: privateKeyPath,
// });

// const vonage = new Vonage(credentials);
import Agora from "agora-access-token";

const { RtcTokenBuilder, RtcRole } = Agora;


export async function createVideoSession(uid, channelName) {
  try {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const role = RtcRole.PUBLISHER;
    const expireTime = 3600; // 1 hour

    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );

    // Return both channel name and token
    return { channelName, token };
  } catch (error) {
    console.error("Failed to create video session:", error);
    throw new Error("Failed to create video session: " + error.message);
  }
}

export const bookAppointment = async (req, res) => {
  const { userId, formData } = req.body; // assume frontend sends userId & formData

  try {
    // 1️⃣ Get the patient
    const patient = await User.findOne({
      clerkUserId: userId,
      role: "patient",
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // 2️⃣ Parse form data
    const doctorId = formData.doctorId;
    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);
    const patientDescription = formData.description || null;

    if (!doctorId || !startTime || !endTime) {
      return res.status(400).json({ error: "Doctor, start time, and end time are required" });
    }

    // 3️⃣ Check doctor exists and is verified
    const doctor = await User.findOne({
      _id: doctorId,
      role: "doctor",
      verificationStatus: "verified",
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found or not verified" });
    }

    // 4️⃣ Check patient credits (2 per appointment)
    if (patient.credits < 2) {
      return res.status(400).json({ error: "Insufficient credits to book an appointment" });
    }

    // 5️⃣ Check overlapping appointments
    const overlappingAppointment = await Appointment.findOne({
      doctorId: doctor._id,
      status: "SCHEDULED",
      $or: [
        { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
        { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
        { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
      ],
    });

    if (overlappingAppointment) {
      return res.status(400).json({ error: "This time slot is already booked" });
    }

    // 6️⃣ Create video session using Agora
    // Use userId as UID and generate a unique channel name per appointment
    const rawChannel = `appointment_${uuidv4().replace(/-/g, "_")}`; // replace dashes with underscores
    const channelName = rawChannel.slice(0, 64); // ensure max length 64

    // Example: "appointment_a1b2c3d4_e5f6_7g8h_9i0j_klmnopqrstuv"
    const { token } = await createVideoSession(patient._id.toString(), channelName);

    // 7️⃣ Deduct credits
    const { success, error } = await deductCreditsForAppointment(patient._id, doctor._id);

    if (!success) {
      return res.status(400).json({ error: error || "Failed to deduct credits" });
    }

    // 8️⃣ Create appointment
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      startTime,
      endTime,
      patientDescription,
      status: "scheduled",
      videoSessionId: channelName, // store channelName as session identifier
      videoToken: token, // optional: store token if you want backend-generated token per appointment
    });

    // 9️⃣ Respond success
    return res.json({ success: true, appointment });
  } catch (err) {
    console.error("Failed to book appointment:", err);
    return res.status(500).json({ error: "Failed to book appointment: " + err.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { userId, appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: "Appointment ID is required" });
    }

    // Find user by clerkUserId
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Check authorization
    if (
      appointment.doctorId.toString() !== user._id.toString() &&
      appointment.patientId.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ error: "Not authorized to cancel this appointment" });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update appointment status
      appointment.status = "cancelled";
      await appointment.save({ session });

      const creditAmount = 2;

      // Create credit transactions
      await CreditTransaction.create(
        [
          {
            userId: appointment.patientId,
            amount: creditAmount,
            type: "APPOINTMENT_DEDUCTION",
          },
          {
            userId: appointment.doctorId,
            amount: -creditAmount,
            type: "APPOINTMENT_DEDUCTION",
          },
        ],
        { session, ordered: true }
      );

      // Update user credit balances
      await User.updateOne(
        { _id: appointment.patientId },
        { $inc: { credits: creditAmount } },
        { session }
      );

      await User.updateOne(
        { _id: appointment.doctorId },
        { $inc: { credits: -creditAmount } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.json({ success: true });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("Transaction failed:", err);
      return res.status(500).json({ error: "Failed to cancel appointment" });
    }
  } catch (error) {
    console.error("Failed to cancel appointment:", error);
    return res.status(500).json({ error: error.message });
  }
};

export async function addAppointmentNotes(req, res) {
  try {
    const { userId } = req.body; // assuming userId is sent in body
    const { appointmentId, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!appointmentId || !notes) {
      return res
        .status(400)
        .json({ success: false, error: "Appointment ID and notes are required" });
    }

    // Find the doctor
    const doctor = await User.findOne({ clerkUserId: userId, role: "doctor" });
    if (!doctor) {
      return res.status(404).json({ success: false, error: "Doctor not found" });
    }

    // Verify the appointment belongs to this doctor
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctorId: doctor._id,
    });

    if (!appointment) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    // Update the appointment notes
    appointment.notes = notes;
    await appointment.save();

    return res.status(200).json({ success: true, appointment });
  } catch (error) {
    console.error("Failed to add appointment notes:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update notes: " + error.message });
  }
}


export async function markAppointmentCompleted(req, res) {
  try {
    const { userId } = req.body; // or from auth middleware
    const { appointmentId } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!appointmentId)
      return res.status(400).json({ error: "Appointment ID is required" });

    // Find the doctor
    const doctor = await User.findOne({ clerkUserId: userId, role: "doctor" });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find the appointment and populate patient
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctorId: doctor._id,
    }).populate("patientId");

    if (!appointment)
      return res
        .status(404)
        .json({ error: "Appointment not found or not authorized" });

    // Check appointment status
    if (appointment.status !== "scheduled")
      return res
        .status(400)
        .json({ error: "Only scheduled appointments can be marked completed" });

    // Check if appointment end time has passed
    const now = new Date();
    if (now < new Date(appointment.endTime))
      return res.status(400).json({
        error: "Cannot mark appointment as completed before the scheduled end time",
      });

    // Update appointment status
    appointment.status = "completed";
    await appointment.save();

    return res.json({ success: true, appointment });
  } catch (error) {
    console.error("Failed to mark appointment as completed:", error);
    res
      .status(500)
      .json({ error: "Failed to mark appointment as completed: " + error.message });
  }
}


export async function generateVideoToken(req, res) {
  try {
    const { userId, appointmentId } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!appointmentId) return res.status(400).json({ error: "Appointment ID is required" });

    // Find the user
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Verify user is part of the appointment
    if (
      appointment.doctorId.toString() !== user.id &&
      appointment.patientId.toString() !== user.id
    ) {
      return res.status(403).json({ error: "You are not authorized to join this call" });
    }

    // Verify appointment is scheduled
    if (appointment.status !== "scheduled") {
      return res.status(400).json({ error: "This appointment is not currently scheduled" });
    }

    // Verify appointment is within valid time range
    const now = new Date();
    const appointmentTime = new Date(appointment.startTime);
    const timeDifference = (appointmentTime - now) / (1000 * 60); // minutes

    if (timeDifference > 30) {
      return res.status(400).json({ error: "The call will be available 30 minutes before the scheduled time" });
    }

    // Generate token
    const appointmentEndTime = new Date(appointment.endTime);
    const expirationTime = Math.floor(appointmentEndTime.getTime() / 1000) + 60 * 60; // 1 hour after end

    const connectionData = JSON.stringify({
      name: user.name,
      role: user.role,
      userId: user.id,
    });

    const token = vonage.video.generateClientToken(appointment.videoSessionId, {
      role: "publisher",
      expireTime: expirationTime,
      data: connectionData,
    });

    // Save token to appointment
    appointment.videoSessionToken = token;
    await appointment.save();

    res.json({
      success: true,
      videoSessionId: appointment.videoSessionId,
      token: token,
    });
  } catch (error) {
    console.error("Failed to generate video token:", error);
    res.status(500).json({ error: "Failed to generate video token: " + error.message });
  }
}

