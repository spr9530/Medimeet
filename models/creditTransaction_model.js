import mongoose from "mongoose";
const creditTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["CREDIT","CREDIT_PURCHASE","ADMIN_ADJUSTMENT", "CREDIT_USED","APPOINTMENT_ADDITION", "APPOINTMENT_DEDUCTION" ], required: true },
    packageId: { type: String }, // if part of a package purchase
  },
  { timestamps: true }
);

export default mongoose.model("CreditTransaction", creditTransactionSchema);
