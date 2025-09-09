import User from "../models/user_model.js";
import CreditTransaction from "../models/creditTransaction_model.js";

export const checkUser = async (req, res) => {
  const user = req.body;

  if (!user.id) {
    return res.status(400).json({ error: "User ID missing" });
  }

  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    let loggedInUser = await User.findOne({ clerkUserId: user.id }).lean();

    if (loggedInUser) {
      const latestTransaction = await CreditTransaction.findOne({
        userId: loggedInUser._id,
        type: "CREDIT", // using our schema
        createdAt: { $gte: startOfMonth },
      })
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        ...loggedInUser,
        transactions: latestTransaction ? [latestTransaction] : [],
      });
    }

    // Create new user
    const name = `${user.firstName} ${user.lastName}`;

    const newUser = await User.create({
      clerkUserId: user.id,
      name,
      imageUrl: user.imageUrl,
      email: user.email,
    });

    // Create initial free transaction
    const freeTransaction = await CreditTransaction.create({
      userId: newUser._id,
      type: "CREDIT",
      packageId: "free_user",
      amount: 2,
    });

    return res.json({ ...newUser.toObject(), transactions: [freeTransaction] });
  } catch (error) {
    console.error("❌ checkUser error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

export async function setUserRole(req, res) {
  try {
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find user in MongoDB
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!role || !["patient", "doctor"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role selection" });
    }

    // For patient role
    if (role === "patient") {
      user.role = "patient";
      await user.save();

      // Optionally, trigger cache revalidation or other logic
      // revalidatePath("/");

      return res.json({ success: true, redirect: "/doctor" });
    }

    // For doctor role
    if (role === "doctor") {
      const { specialty, experience, credentialUrl, description } = req.body;

      if (!specialty || !experience || !credentialUrl || !description) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }

      user.role = "doctor";
      user.specialty = specialty;
      user.experience = experience;
      user.credentialUrl = credentialUrl;
      user.description = description;
      user.verificationStatus = "pending";

      await user.save();

      // revalidatePath("/"); // optional

      return res.json({ success: true, redirect: "/doctor/verification" });
    }
  } catch (error) {
    console.error("Failed to set user role:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCurrent(req, res) {
   try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const user = await User.findOne({ clerkUserId: userId });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error("❌ Failed to get user information:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}