import express from "express";
import { attemptFlightBooking, getAirports, getFlightPrice, getFlights } from "../controllers/userController.js";
import { userAuth } from "../middlewares/userAuth.js";

const router = express.Router();

router.get("/flights",userAuth, getFlights);
router.get("/airports",userAuth, getAirports);
router.get("/flights/price", userAuth, getFlightPrice);
router.post("/flights/attempt", userAuth, attemptFlightBooking);

export default router;