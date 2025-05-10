import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/MongoDb.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import flightRoutes from "./routes/flightRoutes.js";

dotenv.config();

const app = express();

// Restrict CORS to frontend URL
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", flightRoutes);

const PORT = process.env.PORT || 7000;
const startServer = async () => {
  try {
    if (
      !process.env.MONGO_URI ||
      !process.env.JWT_SECRET ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS ||
      !process.env.AMADEUS_API_KEY ||
      !process.env.AMADEUS_API_SECRET
    ) {
      throw new Error("Missing required environment variables");
    }
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server failed to start:", err.message);
    process.exit(1);
  }
};

startServer();