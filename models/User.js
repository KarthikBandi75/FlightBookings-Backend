import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name:{
    type:String,
    trim:true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  wallet: {
    type: Number,
    default: 50000,
  },
  otp: {
    type: String,
    default: null,
  },
  otpExpiresAt: {
    type: Date,
    default: null,
  },
  isOtpVerified: { type: Boolean, default: false }
},{timestamps:true});

export default mongoose.model("User", userSchema);