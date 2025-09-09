import mongoose from "mongoose";
const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    notes: { type: String },
    patientDescription: { type: String },
    videoToken: {type: String},
    videoSessionId: {type: String}
  },
  { timestamps: true }
);

export default mongoose.model("Appointment", appointmentSchema);
