const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// Sensor Schema now includes soil moisture, temperature, and humidity
const sensorSchema = new mongoose.Schema(
  {
    soilmoisture: { type: Number },   // Soil Moisture
    temperature: { type: Number },
    humidity: { type: Number },
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

const SensorData = mongoose.model("SensorData", sensorSchema);

// ------------------------------------------------------
// API to Save Sensor Data
// Expects a JSON payload like:
// { "soilmoisture": 45, "temperature": 25.3, "humidity": 60.5 }
app.post("/api/sensor-data", async (req, res) => {
  try {
    const data = new SensorData(req.body);
    await data.save();
    res.status(201).json({ message: "Data saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save data" });
  }
});

// ------------------------------------------------------
// API to Fetch All Sensor Data (with createdAt and updatedAt)
app.get("/api/sensor-data", async (req, res) => {
  try {
    const data = await SensorData.find({});
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// ------------------------------------------------------
// API to Fetch Latest Sensor Data Entry
app.get("/api/sensor-data/latest", async (req, res) => {
  try {
    const latestData = await SensorData.findOne().sort({ _id: -1 });
    if (!latestData) {
      return res.status(404).json({ error: "No sensor data found" });
    }
    res.status(200).json(latestData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// ------------------------------------------------------
// API to Fetch Only Soil Moisture Data
app.get("/api/sensor-data/soilmoisture", async (req, res) => {
  try {
    // Return only soilmoisture and createdAt fields (adjust projection as needed)
    const data = await SensorData.find({}, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch soil moisture data" });
  }
});

// ------------------------------------------------------
// API to Fetch Only Temperature Data
app.get("/api/sensor-data/temp", async (req, res) => {
  try {
    // Return only temperature and createdAt fields
    const data = await SensorData.find({}, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch temperature data" });
  }
});

// ------------------------------------------------------
// API to Fetch Only Humidity Data
app.get("/api/sensor-data/humidity", async (req, res) => {
  try {
    // Return only humidity and createdAt fields
    const data = await SensorData.find({}, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch humidity data" });
  }
});

// ------------------------------------------------------
// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));