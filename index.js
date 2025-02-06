const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
// MongoDB Connection
// ------------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// ------------------------------------------------------
// Sensor Schema & Model
// ------------------------------------------------------
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
// GENERAL ENDPOINTS
// ------------------------------------------------------

// Save Sensor Data
// Expects payload: { "soilmoisture": 45, "temperature": 25.3, "humidity": 60.5 }
// Save Sensor Data with backend filtering based on major change
// Expects payload: { "soilmoisture": 45, "temperature": 25.3, "humidity": 60.5 }
app.post("/api/sensor-data", async (req, res) => {
  try {
    const newData = req.body;
    
    // Retrieve the most recent entry from the database
    const lastData = await SensorData.findOne({}, {}, { sort: { createdAt: -1 } });
    
    // Define thresholds (these can be adjusted as needed)
    const soilThreshold = 15;      // e.g., 15% change in soil moisture
    const tempThreshold = 5.0;    // e.g., 5°C change in temperature
    const humThreshold = 10.0;     // e.g., 10% change in humidity

    // Flag to decide whether the change is significant
    let significantChange = false;

    if (!lastData) {
      // If no data exists yet, then save the first entry
      significantChange = true;
    } else {
      if (Math.abs(newData.soilmoisture - lastData.soilmoisture) >= soilThreshold) {
        significantChange = true;
      }
      if (Math.abs(newData.temperature - lastData.temperature) >= tempThreshold) {
        significantChange = true;
      }
      if (Math.abs(newData.humidity - lastData.humidity) >= humThreshold) {
        significantChange = true;
      }
    }

    if (significantChange) {
      const data = new SensorData(newData);
      await data.save();
      return res.status(201).json({ message: "Data saved successfully" });
    } else {
      return res.status(200).json({ message: "No significant change, data not saved" });
    }
  } catch (err) {
    console.error("Error saving sensor data:", err);
    res.status(500).json({ error: "Failed to save data" });
  }
});


// Fetch all sensor data
app.get("/api/sensor-data", async (req, res) => {
  try {
    const data = await SensorData.find({});
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Fetch Latest Sensor Data Entry (returns only soilmoisture and createdAt)
// NOTE: This endpoint is used in another project so do not modify it.
app.get("/api/sensor-data/latest", async (req, res) => {
  try {
    const latestData = await SensorData.findOne({}, { soilmoisture: 1, createdAt: 1, _id: 0 }).sort({ _id: -1 });
    if (!latestData) {
      return res.status(404).json({ error: "No sensor data found" });
    }
    res.status(200).json(latestData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// ------------------------------------------------------
// CURRENT READINGS ENDPOINTS (Latest value for each field)
// ------------------------------------------------------
app.get("/api/sensor-data/soilmoisture/current", async (req, res) => {
  try {
    const currentSoil = await SensorData.findOne({}, { soilmoisture: 1, createdAt: 1, _id: 0 }).sort({ _id: -1 });
    if (!currentSoil) {
      return res.status(404).json({ error: "No soil moisture data found" });
    }
    res.status(200).json(currentSoil);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current soil moisture data" });
  }
});

app.get("/api/sensor-data/temp/current", async (req, res) => {
  try {
    const currentTemp = await SensorData.findOne({}, { temperature: 1, createdAt: 1, _id: 0 }).sort({ _id: -1 });
    if (!currentTemp) {
      return res.status(404).json({ error: "No temperature data found" });
    }
    res.status(200).json(currentTemp);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current temperature data" });
  }
});

app.get("/api/sensor-data/humidity/current", async (req, res) => {
  try {
    const currentHum = await SensorData.findOne({}, { humidity: 1, createdAt: 1, _id: 0 }).sort({ _id: -1 });
    if (!currentHum) {
      return res.status(404).json({ error: "No humidity data found" });
    }
    res.status(200).json(currentHum);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current humidity data" });
  }
});

// ------------------------------------------------------
// GENERAL FIELD ENDPOINTS (Return all documents with one field)
// ------------------------------------------------------
app.get("/api/sensor-data/soilmoisture", async (req, res) => {
  try {
    const data = await SensorData.find({}, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch soil moisture data" });
  }
});

app.get("/api/sensor-data/temp", async (req, res) => {
  try {
    const data = await SensorData.find({}, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch temperature data" });
  }
});

app.get("/api/sensor-data/humidity", async (req, res) => {
  try {
    const data = await SensorData.find({}, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch humidity data" });
  }
});

// ------------------------------------------------------
// TIME-FILTERED ENDPOINTS (General: day, week, month, year)
// ------------------------------------------------------

// Helper function: returns a Date object for the time X milliseconds ago
function getDateX(msAgo) {
  return new Date(Date.now() - msAgo);
}

// ----- For Soil Moisture -----
app.get("/api/sensor-data/soilmoisture/day", async (req, res) => {
  try {
    const oneDayAgo = getDateX(24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneDayAgo } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/week", async (req, res) => {
  try {
    const oneWeekAgo = getDateX(7 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneWeekAgo } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch weekly soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/month", async (req, res) => {
  try {
    const oneMonthAgo = getDateX(30 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneMonthAgo } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch monthly soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/year", async (req, res) => {
  try {
    const oneYearAgo = getDateX(365 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneYearAgo } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch yearly soil moisture data" });
  }
});

// ----- For Temperature -----
app.get("/api/sensor-data/temp/day", async (req, res) => {
  try {
    const oneDayAgo = getDateX(24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneDayAgo } }, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily temperature data" });
  }
});

app.get("/api/sensor-data/temp/week", async (req, res) => {
  try {
    const oneWeekAgo = getDateX(7 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneWeekAgo } }, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch weekly temperature data" });
  }
});

app.get("/api/sensor-data/temp/month", async (req, res) => {
  try {
    const oneMonthAgo = getDateX(30 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneMonthAgo } }, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch monthly temperature data" });
  }
});

app.get("/api/sensor-data/temp/year", async (req, res) => {
  try {
    const oneYearAgo = getDateX(365 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneYearAgo } }, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch yearly temperature data" });
  }
});

// ----- For Humidity -----
app.get("/api/sensor-data/humidity/day", async (req, res) => {
  try {
    const oneDayAgo = getDateX(24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneDayAgo } }, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily humidity data" });
  }
});

app.get("/api/sensor-data/humidity/week", async (req, res) => {
  try {
    const oneWeekAgo = getDateX(7 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneWeekAgo } }, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch weekly humidity data" });
  }
});

app.get("/api/sensor-data/humidity/month", async (req, res) => {
  try {
    const oneMonthAgo = getDateX(30 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneMonthAgo } }, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch monthly humidity data" });
  }
});

app.get("/api/sensor-data/humidity/year", async (req, res) => {
  try {
    const oneYearAgo = getDateX(365 * 24 * 60 * 60 * 1000);
    const data = await SensorData.find({ createdAt: { $gte: oneYearAgo } }, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch yearly humidity data" });
  }
});

// ------------------------------------------------------
// NEW: Month Breakdown Endpoints (Grouped by Week) for Soil Moisture
// (You can create similar endpoints for temperature and humidity if desired.)
app.get("/api/sensor-data/soilmoisture/month/week1", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1);
    const end   = new Date(year, month, 7, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch week 1 soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/month/week2", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 8);
    const end   = new Date(year, month, 14, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch week 2 soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/month/week3", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 15);
    const end   = new Date(year, month, 21, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch week 3 soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/month/week4", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 22);
    const end   = new Date(year, month, 28, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch week 4 soil moisture data" });
  }
});

app.get("/api/sensor-data/soilmoisture/month/week5", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 29);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // last day of the month
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch week 5 soil moisture data" });
  }
});

// ------------------------------------------------------
// NEW: Year Breakdown Endpoints (Grouped by Month) for Soil Moisture
// Example: GET /api/sensor-data/soilmoisture/year/jan returns data for January of the current year.
app.get("/api/sensor-data/soilmoisture/year/:month", async (req, res) => {
  try {
    const monthStr = req.params.month.toLowerCase();
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    if (!(monthStr in monthMap)) {
      return res.status(400).json({ error: "Invalid month" });
    }
    const monthIndex = monthMap[monthStr];
    const year = new Date().getFullYear();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { soilmoisture: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch yearly soil moisture data" });
  }
});

// Similarly, Year Breakdown Endpoints for Temperature and Humidity:
app.get("/api/sensor-data/temp/year/:month", async (req, res) => {
  try {
    const monthStr = req.params.month.toLowerCase();
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    if (!(monthStr in monthMap)) {
      return res.status(400).json({ error: "Invalid month" });
    }
    const monthIndex = monthMap[monthStr];
    const year = new Date().getFullYear();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { temperature: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch yearly temperature data" });
  }
});

app.get("/api/sensor-data/humidity/year/:month", async (req, res) => {
  try {
    const monthStr = req.params.month.toLowerCase();
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    if (!(monthStr in monthMap)) {
      return res.status(400).json({ error: "Invalid month" });
    }
    const monthIndex = monthMap[monthStr];
    const year = new Date().getFullYear();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const data = await SensorData.find({ createdAt: { $gte: start, $lte: end } }, { humidity: 1, createdAt: 1, _id: 0 });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch yearly humidity data" });
  }
});

// ------------------------------------------------------
// Start Server
// ------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));