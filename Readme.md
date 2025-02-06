# Backend Sensor Data API

This project is a Node.js backend application that provides an API for managing sensor data. It uses Express for the server framework and MongoDB for data storage.

## Features

- **MongoDB Connection**: Connects to MongoDB Atlas using Mongoose.
- **CORS Support**: Allows cross-origin requests.
- **Sensor Data Management**: 
  - Save sensor data (soil moisture, temperature, humidity).
  - Fetch all sensor data.
  - Fetch the latest sensor data entry.
  - Fetch current readings for soil moisture, temperature, and humidity.
  - Time-filtered endpoints for daily, weekly, monthly, and yearly data.

## API Endpoints

### General Endpoints

- **POST** `/api/sensor-data`: Save sensor data.
  - **Payload**: `{ "soilmoisture": Number, "temperature": Number, "humidity": Number }`
  
- **GET** `/api/sensor-data`: Fetch all sensor data.

- **GET** `/api/sensor-data/latest`: Fetch the latest sensor data entry.

- **POST** `/api/threshold`: Set or update threshold settings.
  - **Payload**: `{ "soilThreshold": Number, "tempThreshold": Number, "humThreshold": Number }`
  
- **GET** `/api/threshold`: Retrieve current threshold settings.

### Current Readings Endpoints

- **GET** `/api/sensor-data/soilmoisture/current`: Fetch current soil moisture data.
- **GET** `/api/sensor-data/temp/current`: Fetch current temperature data.
- **GET** `/api/sensor-data/humidity/current`: Fetch current humidity data.

### Time-Filtered Endpoints

- **GET** `/api/sensor-data/soilmoisture/day`: Fetch daily soil moisture data.
- **GET** `/api/sensor-data/temp/week`: Fetch weekly temperature data.
- **GET** `/api/sensor-data/humidity/month`: Fetch monthly humidity data.

### Month Breakdown Endpoints

- **GET** `/api/sensor-data/soilmoisture/month/week1`: Fetch week 1 soil moisture data for the current month.
- **GET** `/api/sensor-data/soilmoisture/month/week2`: Fetch week 2 soil moisture data for the current month.
- **GET** `/api/sensor-data/soilmoisture/month/week3`: Fetch week 3 soil moisture data for the current month.
- **GET** `/api/sensor-data/soilmoisture/month/week4`: Fetch week 4 soil moisture data for the current month.
- **GET** `/api/sensor-data/soilmoisture/month/week5`: Fetch week 5 soil moisture data for the current month.

### Year Breakdown Endpoints

- **GET** `/api/sensor-data/soilmoisture/year/:month`: Fetch yearly soil moisture data for a specific month (e.g., `/api/sensor-data/soilmoisture/year/jan` for January).
- **GET** `/api/sensor-data/temp/year/:month`: Fetch yearly temperature data for a specific month.
- **GET** `/api/sensor-data/humidity/year/:month`: Fetch yearly humidity data for a specific month.

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file with the following variable:
   ```
   MONGO_URI=<your_mongodb_connection_string>
   ```
4. Start the server:
   ```bash
   node index.js
   ```

## License

This project is licensed under the ISC License.
