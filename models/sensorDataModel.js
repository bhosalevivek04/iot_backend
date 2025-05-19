const mongoose = require("mongoose");

const sensorDataSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    soilmoisture: { type: Number, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SensorData", sensorDataSchema);
