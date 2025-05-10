import express from "express";
import { bookFlight, getBookings } from "../controllers/userController.js";
import { userAuth } from "../middlewares/userAuth.js";
import { getProfile } from "../controllers/authController.js";

const router = express.Router();

router.post("/book", userAuth , bookFlight);
router.get("/bookings", userAuth , getBookings);
router.get("/profile",userAuth,getProfile);

export default router;