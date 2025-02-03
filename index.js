const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
require("dotenv").config();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// Sensor Schema (Removed timestamp field)
const sensorSchema = new mongoose.Schema(
  {
    sensorValue: Number,
  },
  { timestamps: true } // Adds createdAt & updatedAt fields automatically
);
const SensorData = mongoose.model("SensorData", sensorSchema);

// API to Save Sensor Data
app.post("/api/sensor-data", async (req, res) => {
  try {
    const data = new SensorData(req.body);
    await data.save();
    res.status(201).json({ message: "Data saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save data" });
  }
});

// API to Fetch Sensor Data
app.get("/api/sensor-data", async (req, res) => {
  try {
    const data = await SensorData.find({}, { timestamp: 0 }); // Exclude timestamp if any existing documents have it
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// API to Fetch Latest Soil Moisture Data
app.get('/api/sensor-data/latest', async (req, res) => {
  try {
    const latestData = await SensorData.findOne().sort({ _id: -1 }); // Sort by _id to ensure the latest entry
    if (!latestData) {
      return res.status(404).json({ error: "No sensor data found" });
    }
    res.status(200).json(latestData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
