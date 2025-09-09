import User from "../models/user_model.js";
import Availability from "../models/availability_model.js";
import Appointment from "../models/appointment_model.js";
import { addDays, format, endOfDay, addMinutes, isBefore } from "date-fns";

export const getDoctorDetails = async (req, res) => {
  // Use query instead of params
  const { doctorId } = req.query;

  if (!doctorId) {
    return res.status(400).json({ error: "Doctor ID is required" });
  }

  try {
    const doctor = await User.findOne({
      _id: doctorId,
      role: "doctor",
      verificationStatus: "verified",
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.json({ doctor });
  } catch (error) {
    console.error("Failed to fetch doctor:", error);
    res.status(500).json({ error: "Failed to fetch doctor details" });
  }
};

export const getDoctorSlots = async (req, res) => {
  const { doctorId } = req.query;

  if (!doctorId) {
    return res.status(400).json({ error: "Doctor ID is required" });
  }

  try {
    // Fetch doctor
    const doctor = await User.findOne({
      _id: doctorId,
      role: "doctor",
      verificationStatus: "verified",
    });

    if (!doctor) {
      return res.send({});
    }

    // Fetch a single availability record
    const availability = await Availability.findOne({
      doctorId: doctor._id,
      status: "available",
    });

    if (!availability) {
      return res.json({ days: 0 });
    }

    const now = new Date();
    const days = [now, addDays(now, 1), addDays(now, 2), addDays(now, 3)];
    const lastDay = endOfDay(days[3]);

    // Fetch existing appointments for next 4 days
    const existingAppointments = await Appointment.find({
      doctorId: doctor._id,
      status: "schedule",
      startTime: { $lte: lastDay },
    });

    const availableSlotsByDay = {};

    for (const day of days) {
      const dayString = format(day, "yyyy-MM-dd");
      availableSlotsByDay[dayString] = [];

      const availabilityStart = new Date(availability.startTime);
      const availabilityEnd = new Date(availability.endTime);

      // Set current day
      availabilityStart.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
      availabilityEnd.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());

      let current = new Date(availabilityStart);
      const end = new Date(availabilityEnd);

      while (isBefore(addMinutes(current, 30), end) || +addMinutes(current, 30) === +end) {
        const next = addMinutes(current, 30);

        // Skip past slots
        if (isBefore(current, now)) {
          current = next;
          continue;
        }

        // Check overlaps
        const overlaps = existingAppointments.some((appt) => {
          const aStart = new Date(appt.startTime);
          const aEnd = new Date(appt.endTime);
          return (
            (current >= aStart && current < aEnd) ||
            (next > aStart && next <= aEnd) ||
            (current <= aStart && next >= aEnd)
          );
        });

        if (!overlaps) {
          availableSlotsByDay[dayString].push({
            startTime: current.toISOString(),
            endTime: next.toISOString(),
            formatted: `${format(current, "h:mm a")} - ${format(next, "h:mm a")}`,
            day: format(current, "EEEE, MMMM d"),
          });
        }

        current = next;
      }
    }

    // Convert to array for frontend
    const result = Object.entries(availableSlotsByDay).map(([date, slots]) => ({
      date,
      displayDate: slots.length > 0 ? slots[0].day : format(new Date(date), "EEEE, MMMM d"),
      slots,
    }));

    res.json({ days: result });
  } catch (error) {
    console.error("Failed to fetch available slots:", error);
    res.status(500).json({ error: "Failed to fetch available time slots: " + error.message });
  }
};


export const getDoctorBySpeciality = async (req, res) => {
  try {
    const { speciality } = req.query; // ✅ fix: req.query not useQuery

    if (!speciality) {
      return res.status(400).json({ error: "Speciality is required" });
    }

    const doctors = await User.find({
      role: "doctor",
      verificationStatus: "verified",
      specialty: speciality, // Mongoose will directly match the string
    }).sort({ name: 1 }); // ascending order

    console.log(doctors)
    return res.json({ doctors });
  } catch (error) {
    console.error("Failed to fetch doctors by specialty:", error);
    return res.status(500).json({ error: "Failed to fetch doctors" });
  }
};

export const setAvailability = async (req, res) => {
  try {
    const { userId } = req.query;
    const { startTime, endTime } = req.body;

    const doctor = await User.findOne({
      clerkUserId: userId,
      role: "doctor",
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // 2. Validate input
    if (!startTime || !endTime) {
      return res.status(400).json({ error: "Start time and end time are required" });
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ error: "Start time must be before end time" });
    }

    // 3. Check if the doctor already has slots
    const existingSlots = await Availability.find({ doctorId: doctor._id });

    if (existingSlots.length > 0) {
      const slotsWithNoAppointments = existingSlots.filter(
        (slot) => !slot.appointment
      );

      if (slotsWithNoAppointments.length > 0) {
        await Availability.deleteMany({
          _id: { $in: slotsWithNoAppointments.map((slot) => slot._id) },
        });
      }
    }

    // 4. Create new availability slot
    const newSlot = await Availability.create({
      doctorId: doctor._id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: "available",
    });

    return res.json({ success: true, slot: newSlot });
  } catch (error) {
    console.error("Failed to set availability slots:", error);
    return res.status(500).json({ error: "Failed to set availability: " + error.message });
  }
};

export const getDoctorAvailability = async (req, res) => {
  try {
    const { userId } = req.query; // coming from frontend

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: userId missing" });
    }

    // find doctor by clerkUserId and role
    const doctor = await User.findOne({
      clerkUserId: userId,
      role: "doctor"
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // find availability slots for this doctor
    const availabilitySlots = await Availability.find({
      doctorId: doctor._id
    }).sort({ startTime: 1 }); // ascending order

    res.status(200).json({ slots: availabilitySlots });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch availability slots",
      error: error.message
    });
  }
};

export const getDoctorAppointments = async (req, res) => {
  try {
    const { userId } = req.query; // or req.params, based on your route

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find the doctor
    const doctor = await User.findOne({ clerkUserId: userId, role: "doctor" });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Fetch appointments
    const appointments = await Appointment.find({
      doctorId: doctor._id,
      status: { $in: ["scheduled"] },
    })
      .populate("patientId") // equivalent to Prisma `include: { patient: true }`
      .sort({ startTime: 1 }); // ascending order

    return res.status(200).json({ appointments });
  } catch (error) {
    console.error("Error fetching appointments:", error.message);
    return res
      .status(500)
      .json({ error: "Failed to fetch appointments: " + error.message });
  }
};