#include <SoftwareSerial.h>
#include <TinyGPS++.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// ------------------ GPS Setup ------------------
#define GPS_RX D2  // GPS Module TX pin connected to D2 (GPIO4)
#define GPS_TX D1  // GPS Module RX pin connected to D1 (GPIO5)
SoftwareSerial SerialGPS(GPS_RX, GPS_TX);
TinyGPSPlus gps;
float lastLatitude = 0.0, lastLongitude = 0.0;

// ------------------ Sensor & Display Setup ------------------
#define DHTPIN D4          // DHT11 sensor data pin on D4 (GPIO2)
#define DHTTYPE DHT11      // DHT11 sensor type
DHT dht(DHTPIN, DHTTYPE);

// Soil Moisture Sensor connected to Analog Pin A0

// Initialize the I2C LCD using D5 (SDA -> GPIO14) and D6 (SCL -> GPIO12)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ------------------ Wi-Fi, Backend & Threshold Config ------------------
struct DeviceSettings {
  char ssid[30];
  char password[30];
  int soilMoistureThreshold;     // Change threshold in percentage
  float temperatureThreshold;    // Change threshold in °C
  float humidityThreshold;       // Change threshold in percentage
};

DeviceSettings deviceSettings;

// Create a web server on port 80
ESP8266WebServer server(80);

// Backend URL for sensor data
const char* backend_url = "https://iot-backend-6oxx.onrender.com/api/sensor-data";

// ------------------ Timing Variables ------------------
unsigned long previousCycleMillis = 0;
const unsigned long cycleInterval = 5000;  // 5 seconds for display updates
int displayState = 0;  // 0: soil moisture, 1: temperature, 2: humidity, 3: GPS

// Baseline transmission interval (e.g., every 1 minute)
unsigned long lastSendTime = 0;
const unsigned long baselineInterval = 60000; // 60,000 ms = 1 minute

// Minimum interval between event-driven transmissions (to avoid too frequent sends)
const unsigned long minIntervalBetweenSends = 30000; // 30 seconds

// ------------------ Global Variables for Threshold Detection ------------------
int lastSoilMoisture = -1;     // Initialized to an impossible value
float lastTemperature = -1000; // Initialized to an unlikely value
float lastHumidity = -1;       // Initialized to an impossible value

// ------------------ Setup Function ------------------
void setup() {
  Serial.begin(115200);
  SerialGPS.begin(9600);
  dht.begin();

  // Initialize EEPROM for DeviceSettings
  EEPROM.begin(sizeof(DeviceSettings));
  EEPROM.get(0, deviceSettings);
  if (strlen(deviceSettings.ssid) == 0) {
    deviceSettings.ssid[0] = '\0';
    deviceSettings.password[0] = '\0';
    deviceSettings.soilMoistureThreshold = 1;     
    deviceSettings.temperatureThreshold = 1.0;    
    deviceSettings.humidityThreshold = 1.0;       
  }

  // Initialize I2C for LCD
  Wire.begin(14, 12);
  lcd.begin(16, 2);
  lcd.backlight();

  // Display initial message
  lcd.setCursor(0, 0);
  lcd.print("Initializing...");

  // Wi-Fi Setup
  if (strlen(deviceSettings.ssid) > 0) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(deviceSettings.ssid, deviceSettings.password);
    byte tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 30) {
      delay(1000);
      Serial.print(".");
      lcd.setCursor(0, 1);
      lcd.print("Connecting...");
      tries++;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    lcd.setCursor(0, 1);
    lcd.print("WiFi Connected!");
    delay(2000);
  } else {
    // If connection fails, start AP mode for configuration
    Serial.println("\nFailed to connect. Starting AP...");
    WiFi.mode(WIFI_AP);
    WiFi.softAP("Sensor Setup", "admin123");
    Serial.println("AP Started: Sensor Setup (Password: admin123)");
    Serial.print("AP IP Address: ");
    Serial.println(WiFi.softAPIP());
    lcd.setCursor(0, 1);
    lcd.print("AP: Sensor Setup");
    delay(2000);
  }

  // Configure web server routes
  server.on("/", handlePortal);                // Wi-Fi configuration
  server.on("/threshold", handleThresholdPortal); // Threshold configuration
  server.on("/open", handleOpenPortal);
  server.on("/restart", handleRestartForPortal);
  server.begin();
}

// ------------------ Main Loop ------------------
void loop() {
  // Handle web server requests continuously
  server.handleClient();
  unsigned long currentMillis = millis();

  // Process GPS data
  while (SerialGPS.available()) {
    gps.encode(SerialGPS.read());
    if (gps.location.isUpdated()) {
      lastLatitude = gps.location.lat();
      lastLongitude = gps.location.lng();
    }
  }

  // Cycle through display states every cycleInterval (5 sec)
  if (currentMillis - previousCycleMillis >= cycleInterval) {
    previousCycleMillis = currentMillis;
    displayState = (displayState + 1) % 4;  // Now 4 states: 0-soil, 1-temp, 2-humidity, 3-GPS
    lcd.clear();
    if (displayState == 0) {
      displaySoilMoisture();
    } else if (displayState == 1) {
      displayTemperature();
    } else if (displayState == 2) {
      displayHumidity();
    } else if (displayState == 3) {
      displayGPS();
    }
  }

  // Event-driven transmission block (if thresholds are nonzero)
  if (deviceSettings.soilMoistureThreshold > 0 ||
      deviceSettings.temperatureThreshold > 0 ||
      deviceSettings.humidityThreshold > 0) {

    int rawValue = analogRead(A0);
    int soilMoisture = map(rawValue, 0, 1023, 0, 100);
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    bool immediateSend = false;
    
    if (lastSoilMoisture < 0 || abs(soilMoisture - lastSoilMoisture) > deviceSettings.soilMoistureThreshold) {
      immediateSend = true;
    }
    if (lastTemperature < -500 || fabs(temperature - lastTemperature) > deviceSettings.temperatureThreshold) {
      immediateSend = true;
    }
    if (lastHumidity < 0 || fabs(humidity - lastHumidity) > deviceSettings.humidityThreshold) {
      immediateSend = true;
    }

    if (immediateSend && (currentMillis - lastSendTime >= minIntervalBetweenSends)) {
      sendDataToBackend(soilMoisture, temperature, humidity);
      lastSendTime = currentMillis;
    }
  }

  // Baseline transmission: send sensor data every 60 seconds regardless of thresholds
  if (WiFi.status() == WL_CONNECTED && (currentMillis - lastSendTime >= baselineInterval)) {
    int rawValue = analogRead(A0);
    int soilMoisture = map(rawValue, 0, 1023, 0, 100);
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    sendDataToBackend(soilMoisture, temperature, humidity);
    lastSendTime = currentMillis;
  }
}

// ------------------ Display Functions ------------------
void displaySoilMoisture() {
  int rawValue = analogRead(A0);
  int soilMoisture = map(rawValue, 0, 1023, 0, 100);
  lcd.setCursor(0, 0);
  lcd.print("Soil Moisture:");
  lcd.setCursor(0, 1);
  if (soilMoisture == 100) {
    lcd.print("Check Sensor");
    Serial.println("Soil Moisture Sensor error: 100%");
  } else {
    lcd.print(soilMoisture);
    lcd.print(" %");
  }
}

void displayTemperature() {
  float temperature = dht.readTemperature();
  if (isnan(temperature)) {
    lcd.setCursor(0, 0);
    lcd.print("Temp Error!");
    Serial.println("Failed to read temperature!");
    return;
  }
  lcd.setCursor(0, 0);
  lcd.print("Temperature:");
  lcd.setCursor(0, 1);
  lcd.print(temperature);
  lcd.print(" C");
}

void displayHumidity() {
  float humidity = dht.readHumidity();
  if (isnan(humidity)) {
    lcd.setCursor(0, 0);
    lcd.print("Humidity Err!");
    Serial.println("Failed to read humidity!");
    return;
  }
  lcd.setCursor(0, 0);
  lcd.print("Humidity:");
  lcd.setCursor(0, 1);
  lcd.print(humidity);
  lcd.print(" %");
}

void displayGPS() {
  lcd.setCursor(0, 0);
  lcd.print("Lat:");
  lcd.print(lastLatitude, 6);
  lcd.setCursor(0, 1);
  lcd.print("Lng:");
  lcd.print(lastLongitude, 6);
}

// ------------------ Backend Data Transmission ------------------
void sendDataToBackend(int soilMoisture, float temperature, float humidity) {
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Invalid sensor reading, skipping transmission.");
    return;
  }
  if (soilMoisture == 100) {
    Serial.println("Invalid soil moisture reading (100%). Skipping transmission.");
    return;
  }

  Serial.println("Sending data to backend...");

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, backend_url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<300> jsonDoc;
  jsonDoc["soilmoisture"] = soilMoisture;
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = humidity;
  jsonDoc["latitude"] = lastLatitude;
  jsonDoc["longitude"] = lastLongitude;

  String jsonString;
  serializeJson(jsonDoc, jsonString);

  int httpResponseCode = http.POST(jsonString);
  if (httpResponseCode > 0) {
    Serial.print("Backend Response Code: ");
    Serial.println(httpResponseCode);
    Serial.print("Response: ");
    Serial.println(http.getString());
  } else {
    Serial.print("Backend Error Code: ");
    Serial.println(httpResponseCode);
    delay(2000);
  }
  http.end();

  if (httpResponseCode > 0) {
    lastSoilMoisture = soilMoisture;
    lastTemperature = temperature;
    lastHumidity = humidity;
  }
}

// ------------------ Web Server Handlers ------------------
void handlePortal() {
  if (server.method() == HTTP_POST) {
    strncpy(deviceSettings.ssid, server.arg("ssid").c_str(), sizeof(deviceSettings.ssid) - 1);
    strncpy(deviceSettings.password, server.arg("password").c_str(), sizeof(deviceSettings.password) - 1);
    deviceSettings.ssid[sizeof(deviceSettings.ssid) - 1] = '\0';
    deviceSettings.password[sizeof(deviceSettings.password) - 1] = '\0';

    EEPROM.put(0, deviceSettings);
    EEPROM.commit();
    delay(5000);

    server.send(200, "text/html", "<h1>Wi-Fi credentials saved. Restarting device...</h1>");
    delay(5000);
    ESP.restart();
  } else {
    server.send(200, "text/html", R"rawliteral(
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Wi-Fi Setup</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; }
            form { max-width: 300px; margin: auto; padding: 1rem; }
            input, button { width: 100%; margin-bottom: 1rem; padding: 0.5rem; }
            button { background: #007bff; color: white; border: none; cursor: pointer; }
          </style>
        </head>
        <body>
          <h1>Wi-Fi Setup</h1>
          <form method="post">
            <input type="text" name="ssid" placeholder="SSID" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Save</button>
          </form>
          <p><a href="/threshold">Configure Thresholds</a></p>
        </body>
      </html>
    )rawliteral");
  }
}

void handleThresholdPortal() {
  if (server.method() == HTTP_POST) {
    String soilThresholdStr = server.arg("soilThreshold");
    String tempThresholdStr = server.arg("tempThreshold");
    String humThresholdStr  = server.arg("humThreshold");

    deviceSettings.soilMoistureThreshold = soilThresholdStr.toInt();
    deviceSettings.temperatureThreshold = tempThresholdStr.toFloat();
    deviceSettings.humidityThreshold = humThresholdStr.toFloat();

    EEPROM.put(0, deviceSettings);
    EEPROM.commit();
    
    server.send(200, "text/html", "<h1>Threshold settings saved.</h1><p><a href='/'>Return Home</a></p>");
  } else {
    String html = R"rawliteral(
      <!doctype html>
      <html lang="en">
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Threshold Configuration</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; }
            form { max-width: 300px; margin: auto; padding: 1rem; }
            input, button { width: 100%; margin-bottom: 1rem; padding: 0.5rem; }
            button { background: #007bff; color: white; border: none; cursor: pointer; }
          </style>
      </head>
      <body>
          <h1>Threshold Configuration</h1>
          <form method="post">
              <input type="number" name="soilThreshold" placeholder="Soil Moisture Threshold" required>
              <input type="number" step="0.1" name="tempThreshold" placeholder="Temperature Threshold" required>
              <input type="number" step="0.1" name="humThreshold" placeholder="Humidity Threshold" required>
              <button type="submit">Save Thresholds</button>
          </form>
          <p><a href="/">Return Home</a></p>
      </body>
      </html>
    )rawliteral";
    server.send(200, "text/html", html);
  }
}

void handleOpenPortal() {
  server.send(200, "text/html", R"rawliteral(
    <h1>Open Configuration Portal</h1>
    <p>Click the button below to reopen the Wi-Fi configuration portal:</p>
    <form method="post" action="/restart">
      <button type="submit">Reopen Portal</button>
    </form>
  )rawliteral");
}

void handleRestartForPortal() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP("Sensor Setup", "admin123");
  Serial.println("AP Started: Sensor Setup (Password: admin123)");
  Serial.print("AP IP Address: ");
  Serial.println(WiFi.softAPIP());

  server.close();
  server.on("/", handlePortal);
  server.begin();
  server.send(200, "text/html", "<h1>Portal reopened. Connect to 'Sensor Setup' to reconfigure Wi-Fi.</h1>");
}
