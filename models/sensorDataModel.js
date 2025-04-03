// models/sensorDataModel.js
const sensorSchema = new mongoose.Schema(
  {
    soilmoisture: { type: Number },   // Soil Moisture
    temperature: { type: Number },
    humidity: { type: Number },
    userId: { type: String, required: true }, // Unique mobile number of the farmer
    latitude: { type: Number },  // NEW: GPS Latitude
    longitude: { type: Number }  // NEW: GPS Longitude
  },
  { timestamps: true }
);

const SensorData = mongoose.model("SensorData", sensorSchema);
module.exports = SensorData;
