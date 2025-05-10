import axios from "axios";
import cron from "node-cron";
import Flight from "../models/Flight.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";
let accessToken = null;
let tokenExpiresAt = null;

const getAccessToken = async () => {
  if (accessToken && tokenExpiresAt > Date.now() + 60 * 1000) {
    return accessToken;
  }

  if (!process.env.AMADEUS_API_KEY || !process.env.AMADEUS_API_SECRET) {
    throw new Error("Amadeus API credentials are missing");
  }

  try {
    const response = await axios.post(
      `${AMADEUS_BASE_URL}/v1/security/oauth2/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (!response.data.access_token || !response.data.expires_in) {
      throw new Error("Invalid Amadeus token response");
    }

    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
    return accessToken;
  } catch (error) {
    throw new Error(`Failed to fetch Amadeus token: ${error.message}`);
  }
};

export const getAirports = async (req, res) => {
  const { keyword } = req.query;

  if (!keyword || keyword.length < 2) {
    return res.status(400).json({ message: "Keyword must be at least 2 characters" });
  }

  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `${AMADEUS_BASE_URL}/v1/reference-data/locations?subType=AIRPORT&keyword=${keyword}&page[limit]=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.data || !Array.isArray(response.data.data)) {
      return res.status(500).json({ message: "Invalid response from airport search API" });
    }

    const airports = response.data.data.map((location) => ({
      iataCode: location.iataCode || "",
      name: location.name || "",
      city: location.address?.cityName || "",
    }));

    res.status(200).json(airports);
  } catch (error) {
    res.status(500).json({ message: `Airport search failed: ${error.message}` });
  }
};

export const getFlights = async (req, res) => {
  const { origin, destination, departureDate, flightId } = req.query;

  if (flightId) {
    try {
      const flight = await Flight.findOne({ flightId });
      if (!flight) {
        return res.status(404).json({ message: "Flight not found" });
      }
      const now = new Date();
      const timeDiff = flight.lastAttemptTimestamp
        ? (now - flight.lastAttemptTimestamp) / 1000 / 60
        : Infinity;

      if (timeDiff > 10) {
        flight.currentPrice = flight.originalPrice;
        flight.attemptCount = 0;
        flight.lastAttemptTimestamp = null;
        await flight.save();
      }

      return res.status(200).json({
        flightId: flight.flightId,
        flightNumber: flight.flightNumber || "",
        airline: flight.airline || "",
        origin: flight.origin || "",
        destination: flight.destination || "",
        originAirport: flight.originAirport || "",
        destinationAirport: flight.destinationAirport || "",
        departureTime: flight.departureTime || "",
        arrivalTime: flight.arrivalTime || "",
        duration: flight.duration || "",
        currentPrice: flight.currentPrice,
      });
    } catch (error) {
      return res.status(500).json({ message: `Flight retrieval failed: ${error.message}` });
    }
  }

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ message: "Origin, destination, and departure date are required" });
  }

  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=1&max=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.data || !Array.isArray(response.data.data)) {
      return res.status(500).json({ message: "Invalid response from flight search API" });
    }

    const carriers = response.data.dictionaries?.carriers || {};
    const flightData = response.data.data.slice(0, 10);
    const flights = await Promise.all(
      flightData.map(async (flight, index) => {
        const flightId = `FLIGHT_${index}_${origin}_${destination}_${Date.now()}`;
        const airlineCode = flight.validatingAirlineCodes[0] || "AI";
        const airline = carriers[airlineCode] || "Air India";
        const segment = flight.itineraries[0].segments[0];
        const departureTime = segment.departure.at || "";
        const arrivalTime = segment.arrival.at || "";
        const duration = segment.duration || "";
        const priceInInr = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000;

        const airportNames = {
          DEL: "Indira Gandhi International",
          HYD: "Rajiv Gandhi International",
          BOM: "Chhatrapati Shivaji Maharaj International",
          BLR: "Kempegowda International",
        };

        const mockFlightNumber = `${airlineCode}-${100 + index}`;

        await Flight.findOneAndUpdate(
          { flightId },
          {
            flightId,
            airline,
            airlineCode,
            flightNumber: mockFlightNumber,
            origin: segment.departure.iataCode || origin,
            destination: segment.arrival.iataCode || destination,
            originAirport: airportNames[segment.departure.iataCode] || segment.departure.iataCode || origin,
            destinationAirport: airportNames[segment.arrival.iataCode] || segment.arrival.iataCode || destination,
            departureTime,
            arrivalTime,
            duration,
            originalPrice: priceInInr,
            currentPrice: priceInInr,
            attemptCount: 0,
            lastAttemptTimestamp: null,
          },
          { upsert: true, new: true }
        );

        return {
          flightId,
          flightNumber: mockFlightNumber,
          airline,
          origin: segment.departure.iataCode || origin,
          destination: segment.arrival.iataCode || destination,
          originAirport: airportNames[segment.departure.iataCode] || segment.departure.iataCode || origin,
          destinationAirport: airportNames[segment.arrival.iataCode] || segment.arrival.iataCode || destination,
          departureTime,
          arrivalTime,
          duration,
          price: priceInInr,
        };
      })
    );

    while (flights.length < 10) {
      const index = flights.length;
      const flightId = `FLIGHT_${index}_${origin}_${destination}_${Date.now()}`;
      const priceInInr = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000;
      const mockFlightNumber = `AI-${100 + index}`;
      const mockDepartureTime = "2025-05-15T08:00:00";
      const mockArrivalTime = "2025-05-15T10:15:00";
      const mockDuration = "PT2H15M";

      const airportNames = {
        DEL: "Indira Gandhi International",
        HYD: "Rajiv Gandhi International",
        BOM: "Chhatrapati Shivaji Maharaj International",
        BLR: "Kempegowda International",
      };

      const mockFlight = await Flight.findOneAndUpdate(
        { flightId },
        {
          flightId,
          airline: "Air India",
          airlineCode: "AI",
          flightNumber: mockFlightNumber,
          origin,
          destination,
          originAirport: airportNames[origin] || origin,
          destinationAirport: airportNames[destination] || destination,
          departureTime: mockDepartureTime,
          arrivalTime: mockArrivalTime,
          duration: mockDuration,
          originalPrice: priceInInr,
          currentPrice: priceInInr,
          attemptCount: 0,
          lastAttemptTimestamp: null,
        },
        { upsert: true, new: true }
      );

      flights.push({
        flightId: mockFlight.flightId,
        flightNumber: mockFlight.flightNumber,
        airline: mockFlight.airline,
        origin: mockFlight.origin,
        destination: mockFlight.destination,
        originAirport: mockFlight.originAirport,
        destinationAirport: mockFlight.destinationAirport,
        departureTime: mockFlight.departureTime,
        arrivalTime: mockFlight.arrivalTime,
        duration: mockFlight.duration,
        price: mockFlight.currentPrice,
      });
    }

    res.status(200).json(flights);
  } catch (error) {
    res.status(500).json({ message: `Please Enter Correct AIRPORT Codes` });
  }
};

export const getFlightPrice = async (req, res) => {
  const { flightId } = req.query;
  if (!flightId) {
    return res.status(400).json({ message: "Flight ID is required" });
  }

  try {
    const flight = await Flight.findOne({ flightId });
    if (!flight) {
      return res.status(404).json({ message: "Flight not found" });
    }

    const now = new Date();
    const timeDiff = flight.lastAttemptTimestamp
      ? (now - flight.lastAttemptTimestamp) / 1000 / 60
      : Infinity;

    if (timeDiff > 10) {
      await Flight.updateOne(
        { flightId },
        {
          $set: {
            currentPrice: flight.originalPrice,
            attemptCount: 0,
            lastAttemptTimestamp: null,
          }
        }
      );
      flight.currentPrice = flight.originalPrice;
    }

    res.status(200).json({
      flightId: flight.flightId,
      currentPrice: flight.currentPrice,
    });
  } catch (error) {
    res.status(500).json({ message: `Price retrieval failed: ${error.message}` });
  }
};

export const attemptFlightBooking = async (req, res) => {
  const { flightId } = req.body;
  const userId = req.user.userId;

  try {
    const flight = await Flight.findOne({ flightId });
    if (!flight) {
      return res.status(404).json({ message: "Flight not found" });
    }

    const now = new Date();
    const timeDiff = flight.lastAttemptTimestamp
      ? (now - flight.lastAttemptTimestamp) / 1000 / 60
      : Infinity;

    if (timeDiff > 10) {
      flight.currentPrice = flight.originalPrice;
      flight.attemptCount = 0;
      flight.lastAttemptTimestamp = null;
    }

    flight.attemptCount += 1;
    flight.lastAttemptTimestamp = now;

    if (flight.attemptCount > 3 && timeDiff <= 5) {
      flight.currentPrice = Math.round(flight.currentPrice * 1.1);
    }

    await flight.save();

    res.status(200).json({
      success: true,
      flightId: flight.flightId,
      currentPrice: flight.currentPrice,
    });
  } catch (error) {
    res.status(500).json({ message: `Booking attempt failed: ${error.message}` });
  }
};

export const bookFlight = async (req, res) => {
  const { flightId } = req.body;
  const userId = req.user.userId;

  try {
    const flight = await Flight.findOne({ flightId });
    if (!flight) {
      return res.status(404).json({ message: "Flight not found" });
    }

    const now = new Date();
    const timeDiff = flight.lastAttemptTimestamp
      ? (now - flight.lastAttemptTimestamp) / 1000 / 60
      : Infinity;

    if (timeDiff > 10) {
      flight.currentPrice = flight.originalPrice;
      flight.attemptCount = 0;
      flight.lastAttemptTimestamp = null;
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.wallet < flight.currentPrice) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    user.wallet -= flight.currentPrice;
    await user.save();

    const booking = await Booking.create({
      userId,
      flightId,
      price: flight.currentPrice,
      airline: flight.airline || "",
      origin: flight.origin || "",
      destination: flight.destination || "",
      flightNumber: flight.flightNumber || "",
      departureTime: flight.departureTime || "",
      arrivalTime: flight.arrivalTime || "",
      duration: flight.duration || "",
    });

    await flight.save();

    res.status(200).json({
      success: true,
      bookingId: booking._id,
      price: flight.currentPrice,
      wallet: user.wallet,
    });
  } catch (error) {
    res.status(500).json({ message: `Booking failed: ${error.message}` });
  }
};

export const getBookings = async (req, res) => {
  const userId = req.user.userId;

  try {
    const bookings = await Booking.find({ userId });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: `Bookings retrieval failed: ${error.message}` });
  }
};

cron.schedule("*/10 * * * *", async () => {
  try {
    const now = new Date();
    await Flight.updateMany(
      {
        lastAttemptTimestamp: { $lt: new Date(now - 10 * 60 * 1000) },
        attemptCount: { $gt: 0 },
      },
      [
        {
          $set: {
            currentPrice: "$originalPrice",
            attemptCount: 0,
            lastAttemptTimestamp: null,
          },
        },
      ]
    );
    console.log("Flight prices reset successfully");
  } catch (error) {
    console.error("Error resetting flight prices:", error.message);
  }
});

