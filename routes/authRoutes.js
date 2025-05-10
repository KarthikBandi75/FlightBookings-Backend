import express from "express";
import { signup, verifyOtp, login, forgotPassword, verifyForgotOtp, resetPassword } from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-otp", verifyForgotOtp);
router.post("/reset-password", resetPassword);
export default router;