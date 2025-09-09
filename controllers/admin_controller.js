// controllers/admin_controller.js
import User from "../models/user_model.js";
import Payout from "../models/payout_model.js";
import CreditTransaction from "../models/creditTransaction_model.js";
import mongoose from "mongoose";



// ✅ Verify admin
export const verifyAdmin = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "UserId is required" });
    }

    const user = await User.findOne({clerkUserId: userId});
    console.log(user)
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(200).json({ success: true, isAdmin: true });
    } else {
      return res
        .status(403)
        .json({ success: false, isAdmin: false, message: "Not an admin" });
    }
  } catch (error) {
    console.error("❌ Error verifying admin:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Get pending doctors
export const getPendingDoctors = async (req, res) => {
  try {
    const pendingDoctors = await User.find({
      role: "doctor",
      verificationStatus: "pending",
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, doctors: pendingDoctors });
  } catch (error) {
    console.error("❌ Error fetching pending doctors:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ✅ Get verified doctors
export const getVerifiedDoctors = async (req, res) => {
  try {
    const verifiedDoctors = await User.find({
      role: "doctor",
      verificationStatus: "verified",
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, doctors: verifiedDoctors });
  } catch (error) {
    console.error("❌ Error fetching verified doctors:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ✅ Update doctor status
export const updateDoctorStatus = async (req, res) => {
  try {
    const { doctorId, status } = req.body;

    if (!doctorId || !["verified", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid input" });
    }

    const updatedDoctor = await User.findByIdAndUpdate(
      doctorId,
      { verificationStatus: status },
      { new: true }
    );

    if (!updatedDoctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    return res.json({ success: true, doctor: updatedDoctor });
  } catch (error) {
    console.error("Failed to update doctor status:", error);
    res
      .status(500)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
};

// ✅ Suspend/unsuspend doctor
export const suspendDoctor = async (req, res) => {
  try {
    const { doctorId, suspend } = req.body;

    if (!doctorId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor ID is required" });
    }

    const status = suspend ? "pending" : "verified";
    console.log(status)

    const updatedDoctor = await User.findByIdAndUpdate(
      doctorId,
      { verificationStatus: status },
      { new: true }
    );

    if (!updatedDoctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    res.json({ success: true, doctor: updatedDoctor });
  } catch (error) {
    console.error("Error updating doctor status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPendingPayouts = async (req, res) => {
  try {
    const pendingPayouts = await Payout.find({ status: "PROCESSING" })
      .populate("doctorId", "id name email specialty credits") // join doctor fields
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json({ payouts: pendingPayouts });
  } catch (error) {
    console.error("Failed to fetch pending payouts:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to fetch pending payouts", error: error.message });
  }
};

export const approvePayout = async (req, res) => {
  const { payoutId, userId } = req.body; // userId = admin user who is approving

  if (!payoutId) {
    return res.status(400).json({ message: "Payout ID is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify admin
    const admin = await User.findOne({ clerkUserId: userId, role: "admin" }).session(session);
    if (!admin) {
      throw new Error("Unauthorized: Only admins can approve payouts");
    }

    // Find the payout
    const payout = await Payout.findOne({
      _id: payoutId,
      status: "PROCESSING",
    })
      .populate("doctorId")
      .session(session);

    if (!payout) {
      throw new Error("Payout request not found or already processed");
    }

    // Check doctor's credit balance
    if (payout.doctorId.credits < payout.credits) {
      throw new Error("Doctor does not have enough credits for this payout");
    }

    // Update payout status
    payout.status = "PROCESSED";
    payout.processedAt = new Date();
    payout.processedBy = admin._id.toString();
    await payout.save({ session });

    // Deduct credits from doctor
    payout.doctorId.credits -= payout.credits;
    await payout.doctorId.save({ session });

    // Log credit deduction
    await CreditTransaction.create(
      [
        {
          userId: payout.doctorId._id,
          amount: -payout.credits,
          type: "ADMIN_ADJUSTMENT",
          note: `Payout approved by ${admin.name || "Admin"}`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, payoutId });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Failed to approve payout:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to approve payout", error: error.message });
  }
};
