import mongoose from "mongoose";
const availabilitySchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ["available", "booked", "cancelled"], default: "available" },
  },
  { timestamps: true }
);

export default mongoose.model("Availability", availabilitySchema);
