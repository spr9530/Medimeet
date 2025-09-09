import mongoose from "mongoose";

// Connect MongoDB
export default function connectDb(){
    mongoose
        .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            console.log("✅ MongoDB Connected");
        })
        .catch((err) => console.error("❌ DB Connection Error:", err));
}