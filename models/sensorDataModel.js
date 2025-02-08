// models/sensorDataModel.js
const mongoose = require("mongoose");

const sensorSchema = new mongoose.Schema(
  {
    soilmoisture: { type: Number },   // Soil Moisture
    temperature: { type: Number },
    humidity: { type: Number },
    userId: { type: String, required: true } // NEW: Unique mobile number of the farmer
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

const SensorData = mongoose.model("SensorData", sensorSchema);
module.exports = SensorData;