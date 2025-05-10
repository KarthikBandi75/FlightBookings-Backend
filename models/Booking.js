import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  flightId: { type: String, required: true },
  price: { type: Number, required: true },
  airline: { type: String, required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  flightNumber: { type: String, required: true },
  departureTime: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  duration: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Booking", bookingSchema);