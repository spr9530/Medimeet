import mongoose from "mongoose";

const { Schema } = mongoose;

const payoutSchema = new Schema(
    {
        doctorId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        credits: {
            type: Number,
            required: true
        },
        platformFee: {
            type: Number,
            required: true,
        },
        netAmount: {
            type: Number,
            required: true,
        },
        paypalEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        status: {
            type: String,
            enum: ["PROCESSING", "PROCESSED"],
            default: "PROCESSING",
        },
        processedAt: {
            type: Date,
            default: null,
        },
        processedBy: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes
// payoutSchema.index({ status: 1, createdAt: 1 });
// payoutSchema.index({ doctorId: 1, status: 1 });

const Payout = mongoose.model("Payout", payoutSchema);

export default Payout;
