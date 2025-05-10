import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email service credentials are missing");
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpiresAt,
    });

    await transporter.sendMail({
      from:`"Cloud Trip" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for Signup",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    res.status(500).json({ message: `Signup failed: ${error.message}` });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.otp !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({ token, message: "Signup successful" });
  } catch (error) {
    res.status(500).json({ message: `OTP verification failed: ${error.message}` });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({ token, message: "Login successful" });
  } catch (error) {
    res.status(500).json({ message: `Login failed: ${error.message}` });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password -otp -otpExpiresAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user, message: "Profile fetched successfully" });
  } catch (error) {
    console.error("Error fetching profile:", error.message);
    res.status(500).json({ message: `Profile retrieval failed: ${error.message}` });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email service credentials are missing");
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await transporter.sendMail({
      from:`"Cloud Trip" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for Email Verification",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    res.status(500).json({ message: `Password reset OTP failed: ${error.message}` });
  }
};

export const verifyForgotOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.otp !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.otp = null;
    user.otpExpiresAt = null;
    user.isOtpVerified = true;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    res.status(500).json({ message: `OTP verification failed: ${error.message}` });
  }
};

export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.isOtpVerified) {
      return res.status(400).json({ message: "OTP verification required" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.isOtpVerified = false;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: `Password reset failed: ${error.message}` });
  }
};
