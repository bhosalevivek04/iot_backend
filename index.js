const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const SensorData = require("./models/sensorDataModel");
const { getDateX, getMonthWeekRange } = require("./utils/dateUtils");

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

app.post("/api/sensor-data", async (req, res) => {
  try {
    const {
      soilmoisture,
      temperature,
      humidity,
      userId = "9607561857",
      latitude = null,
      longitude = null,
    } = req.body;

    if ([soilmoisture, temperature, humidity].some(v => typeof v !== "number" || isNaN(v))) {
      return res.status(400).json({ error: "Invalid sensor data types" });
    }

    const lastData = await SensorData.findOne({ userId }).sort({ createdAt: -1 });
    const thresholds = {
      soilmoisture: Number(process.env.SOIL_THRESHOLD) || 3,
      temperature:  Number(process.env.TEMP_THRESHOLD) || 3,
      humidity:     Number(process.env.HUM_THRESHOLD) || 3,
    };

    const hasSignificantChange =
      !lastData ||
      Math.abs(soilmoisture - lastData.soilmoisture) >= thresholds.soilmoisture ||
      Math.abs(temperature  - lastData.temperature ) >= thresholds.temperature  ||
      Math.abs(humidity     - lastData.humidity    ) >= thresholds.humidity;

    if (hasSignificantChange) {
      await new SensorData({ userId, soilmoisture, temperature, humidity, latitude, longitude }).save();
      return res.status(201).json({ message: "Data saved" });
    } else {
      return res.status(200).json({ message: "No significant change" });
    }
  } catch (err) {
    console.error("Error in POST /api/sensor-data:", err);
    return res.status(500).json({ error: "Failed to process sensor data" });
  }
});

app.get("/api/sensor-data/user/:userId", async (req, res) => {
  try {
    const data = await SensorData.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
    if (!data) return res.status(404).json({ error: "No data found" });
    return res.json(data);
  } catch (err) {
    console.error("Error in GET /api/sensor-data/user/:userId:", err);
    return res.status(500).json({ error: "Failed to fetch user data" });
  }
});

app.get("/api/sensor-data/:field/:period", async (req, res) => {
  const { field, period } = req.params;
  const valid = ["soilmoisture", "temperature", "humidity"];
  if (!valid.includes(field)) {
    return res.status(400).json({ error: "Invalid field" });
  }

  let since;
  switch (period) {
    case "day":   since = getDateX(24 * 3600e3); break;
    case "week":  since = getDateX(7  * 24 * 3600e3); break;
    case "month": since = getDateX(30 * 24 * 3600e3); break;
    case "year":  since = getDateX(365* 24 * 3600e3); break;
    default:
      return res.status(400).json({ error: "Invalid period" });
  }

  try {
    const data = await SensorData.find(
      { createdAt: { $gte: since } },
      { [field]: 1, createdAt: 1, _id: 0 }
    );
    return res.json(data);
  } catch (err) {
    console.error(`Error in GET /api/sensor-data/${field}/${period}:`, err);
    return res.status(500).json({ error: "Failed to fetch data" });
  }
});


app.get("/api/sensor-data/:field/month/week/:weekNumber", async (req, res) => {
  const { field, weekNumber } = req.params;
  const valid = ["soilmoisture", "temperature", "humidity"];
  const week = parseInt(weekNumber, 10);

  if (!valid.includes(field) || week < 1 || week > 5) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { start, end } = getMonthWeekRange(new Date().getFullYear(), new Date().getMonth(), week);
  try {
    const data = await SensorData.find(
      { createdAt: { $gte: start, $lte: end } },
      { [field]: 1, createdAt: 1, _id: 0 }
    );
    return res.json(data);
  } catch (err) {
    console.error("Error in GET month/week:", err);
    return res.status(500).json({ error: "Failed to fetch week data" });
  }
});

app.get("/api/sensor-data/:field/year/:month", async (req, res) => {
  const { field, month } = req.params;
  const valid  = ["soilmoisture", "temperature", "humidity"];
  const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

  if (!valid.includes(field) || !(month.toLowerCase() in months)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const mi = months[month.toLowerCase()];
  const yr = new Date().getFullYear();
  const start = new Date(yr, mi, 1);
  const end   = new Date(yr, mi + 1, 0, 23, 59, 59, 999);

  try {
    const data = await SensorData.find(
      { createdAt: { $gte: start, $lte: end } },
      { [field]: 1, createdAt: 1, _id: 0 }
    );
    return res.json(data);
  } catch (err) {
    console.error("Error in GET year/month:", err);
    return res.status(500).json({ error: "Failed to fetch monthly data" });
  }
});


app.get("/api/sensor-data", async (req, res) => {
  const page  = Math.max(parseInt(req.query.page, 10)  || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10)|| 100, 1000);

  try {
    const data = await SensorData.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return res.json(data);
  } catch (err) {
    console.error("Error in GET /api/sensor-data:", err);
    return res.status(500).json({ error: "Failed to fetch sensor data" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));