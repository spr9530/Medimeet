import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    imageUrl: { type: String },
    role: { type: String, enum: ["doctor", "patient", "admin", "unassigned"], default: "unassigned" },
    credits: { type: Number, default: 0 },
    specialty: { type: String }, // for doctors
    experience: { type: Number }, // in years
    credentialUrl: { type: String },
    description: { type: String },
    verificationStatus: { type: String, enum: ["pending", "approved", "rejected", "verified"], default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
