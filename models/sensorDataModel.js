const mongoose = require("mongoose");
<<<<<<< HEAD

const sensorDataSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    soilmoisture: { type: Number, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
=======
const sensorSchema = new mongoose.Schema(
  {
    soilmoisture: { type: Number },   // Soil Moisture
    temperature: { type: Number },
    humidity: { type: Number },
    userId: { type: String, required: true }, // Unique mobile number of the farmer
    latitude: { type: Number },  // NEW: GPS Latitude
    longitude: { type: Number }  // NEW: GPS Longitude
>>>>>>> a7cad285ef54773139be90396ff138818afde93d
  },
  { timestamps: true }
);

<<<<<<< HEAD
module.exports = mongoose.model("SensorData", sensorDataSchema);
=======
const SensorData = mongoose.model("SensorData", sensorSchema);
module.exports = SensorData;
>>>>>>> a7cad285ef54773139be90396ff138818afde93d
