import User from "../models/user_model.js";
import CreditTransaction from "../models/creditTransaction_model.js";
import mongoose from "mongoose"
// Credits per plan
const PLAN_CREDITS = {
  free_user: 2,
  standard: 10,
  premium: 24,
};

const APPOINTMENT_CREDIT_COST = 2;

/**
 * Checks user's subscription and allocates monthly credits
 */
export const checkAndAllocateCredits = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    const { user: clerkUser, currentPlan } = req.body;

    if (!clerkUser) {
      return res.status(400).json({ message: "User is required" });
    }

    // Only patients get monthly credits
    if (clerkUser.role !== "patient") {
      return res.status(200).json({ message: "Not a patient, no credits allocated" });
    }

    if (!currentPlan || !(currentPlan in PLAN_CREDITS)) {
      return res.status(200).json({ message: "Invalid or missing plan" });
    }

    // Find MongoDB User by email (Clerk → Mongo relation)
    const mongoUser = await User.findOne({ email: clerkUser.email });
    if (!mongoUser) {
      return res.status(404).json({ message: "User not found in MongoDB" });
    }

    const creditsToAllocate = PLAN_CREDITS[currentPlan];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // Check if credits already allocated this month for this plan
    const latestTransaction = await CreditTransaction.findOne({
      userId: mongoUser._id,
      type: "CREDIT_PURCHASE",
      packageId: currentPlan,
      createdAt: { $gte: startOfMonth },
    }).sort({ createdAt: -1 });

    if (latestTransaction) {
      return res.status(200).json({ message: "Credits already allocated this month" });
    }

    // Allocate credits
    const transaction = await CreditTransaction.create(
      [
        {
          userId: mongoUser._id,
          amount: creditsToAllocate,
          type: "CREDIT_PURCHASE",
          packageId: currentPlan,
        },
      ],
      { session }
    );

    const updatedUser = await User.findByIdAndUpdate(
      mongoUser._id,
      { $inc: { credits: creditsToAllocate } },
      { new: true, session }
    );

    await session.commitTransaction();
    return res.status(200).json({ ...updatedUser.toObject(), transactions: transaction });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Failed to allocate credits:", error.message);
    res.status(500).json({ message: "Error allocating credits", error: error.message });
  } finally {
    session.endSession();
  }
};



export const deductCreditsForAppointment = async (userId, doctorId) => {
  const APPOINTMENT_CREDIT_COST = 2; // set your cost here

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Fetch patient and doctor
    const user = await User.findById(userId).session(session);
    const doctor = await User.findById(doctorId).session(session);

    if (!user) throw new Error("Patient not found");
    if (!doctor) throw new Error("Doctor not found");

    if (user.credits < APPOINTMENT_CREDIT_COST) {
      throw new Error("Insufficient credits to book an appointment");
    }

    // 2️⃣ Create credit transaction records
    await CreditTransaction.create(
  [
    {
      userId: user._id,
      amount: -APPOINTMENT_CREDIT_COST,
      type: "APPOINTMENT_DEDUCTION",
    },
    {
      userId: doctor._id,
      amount: APPOINTMENT_CREDIT_COST,
      type: "APPOINTMENT_ADDITION",
    },
  ],
  { session, ordered: true } // ✅ add ordered: true
);

    // 3️⃣ Update user and doctor credit balances
    user.credits -= APPOINTMENT_CREDIT_COST;
    doctor.credits += APPOINTMENT_CREDIT_COST;

    await user.save({ session });
    await doctor.save({ session });

    // 4️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    return { success: true, user };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Failed to deduct credits:", error);
    return { success: false, error: error.message };
  }
};

