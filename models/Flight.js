import mongoose from "mongoose";

const flightSchema = new mongoose.Schema({
  flightId: { type: String, required: true, unique: true },
  airline: { type: String },
  airlineCode: { type: String },
  flightNumber: { type: String },
  origin: { type: String },
  destination: { type: String },
  originAirport: { type: String },
  destinationAirport: { type: String },
  departureTime: { type: String },
  arrivalTime: { type: String },
  duration: { type: String },
  originalPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  attemptCount: { type: Number, default: 0 },
  lastAttemptTimestamp: { type: Date },
});

export default mongoose.model("Flight", flightSchema);