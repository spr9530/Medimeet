import User from "../models/user_model.js";
import Appointment from "../models/appointment_model.js";

export const getPatientAppointments = async (req, res) => {
  try {
    const { userId } = req.query;

    // find patient by clerkUserId
    const user = await User.findOne({ clerkUserId: userId, role: "patient" }).select("_id");

    if (!user) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // find appointments for this patient
    const appointments = await Appointment.find({ patientId: user._id })
      .populate("doctorId", "id name specialty imageUrl")
      .sort({ startTime: 1 });

    return res.json({ appointments });
  } catch (error) {
    console.error("Failed to get patient appointments:", error);
    return res.status(500).json({ error: "Failed to fetch appointments" });
  }
};
