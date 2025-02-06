#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// ------------------ Sensor & Display Setup ------------------
#define DHTPIN D4          // DHT11 sensor data pin on D4 (GPIO2)
#define DHTTYPE DHT11      // DHT11 sensor type
DHT dht(DHTPIN, DHTTYPE);

// Soil Moisture Sensor connected to Analog Pin A0

// Initialize the I2C LCD using D5 (SDA -> GPIO14) and D6 (SCL -> GPIO12)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ------------------ Wi-Fi & Backend Setup ------------------
ESP8266WebServer server(80);  // Create a web server on port 80

// Structure for storing Wi-Fi credentials
struct settings {
  char ssid[30];
  char password[30];
} user_wifi = {};

// Backend URL for sensor data
const char* backend_url = "https://iot-backend-6oxx.onrender.com/api/sensor-data";

// ------------------ Timing Variables ------------------
unsigned long previousCycleMillis = 0;
const unsigned long cycleInterval = 5000;  // 5 seconds for display updates
int displayState = 0;  // 0: soil moisture, 1: temperature, 2: humidity

// Baseline transmission interval (e.g., every 3 minutes)
unsigned long lastSendTime = 0;
const unsigned long baselineInterval = 180000; // 180,000 ms = 3 minutes

// Minimum interval between event-driven transmissions (to avoid too frequent sends)
const unsigned long minIntervalBetweenSends = 30000; // 30 seconds

// ------------------ Global Variables for Threshold Detection ------------------
// These variables store the last sensor values that were sent to the backend.
int lastSoilMoisture = -1;     // Initialized to an impossible value
float lastTemperature = -1000; // Initialized to an unlikely value
float lastHumidity = -1;       // Initialized to an impossible value

// Define thresholds for significant change
const int soilMoistureThreshold = 5;      // e.g., 5% change
const float temperatureThreshold = 1.0;   // e.g., 1°C change
const float humidityThreshold = 3.0;      // e.g., 3% change

// ------------------ Setup Function ------------------
void setup() {
  Serial.begin(115200);

  // Initialize EEPROM for Wi-Fi credentials
  EEPROM.begin(sizeof(settings));
  EEPROM.get(0, user_wifi);

  // Start DHT sensor
  dht.begin();

  // Initialize I2C for LCD
  Wire.begin(14, 12);
  lcd.begin(16, 2);
  lcd.backlight();

  // Display initial message
  lcd.setCursor(0, 0);
  lcd.print("Initializing...");

  // Wi-Fi Setup
  WiFi.mode(WIFI_STA);
  WiFi.begin(user_wifi.ssid, user_wifi.password);
  byte tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(1000);
    Serial.print(".");
    lcd.setCursor(0, 1);
    lcd.print("Connecting...");
    tries++;
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
  server.on("/", handlePortal);
  server.on("/open", handleOpenPortal);
  server.on("/restart", handleRestartForPortal);
  server.begin();
}

// ------------------ Main Loop ------------------
void loop() {
  // Handle web server requests continuously
  server.handleClient();
  unsigned long currentMillis = millis();

  // Cycle through display states every cycleInterval (5 sec)
  if (currentMillis - previousCycleMillis >= cycleInterval) {
    previousCycleMillis = currentMillis;
    displayState = (displayState + 1) % 3;
    lcd.clear();
    if (displayState == 0) {
      displaySoilMoisture();
    } else if (displayState == 1) {
      displayTemperature();
    } else if (displayState == 2) {
      displayHumidity();
    }

    // Also check sensor readings for threshold-based (event-driven) transmission
    int rawValue = analogRead(A0);
    int soilMoisture = map(rawValue, 0, 1023, 0, 100);
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    bool immediateSend = false;
    if (lastSoilMoisture < 0 || abs(soilMoisture - lastSoilMoisture) >= soilMoistureThreshold) {
      immediateSend = true;
    }
    if (lastTemperature < -500 || fabs(temperature - lastTemperature) >= temperatureThreshold) {
      immediateSend = true;
    }
    if (lastHumidity < 0 || fabs(humidity - lastHumidity) >= humidityThreshold) {
      immediateSend = true;
    }

    // If a significant change is detected and enough time has passed, send data immediately
    if (immediateSend && (currentMillis - lastSendTime >= minIntervalBetweenSends)) {
      sendDataToBackend(soilMoisture, temperature, humidity);
      lastSendTime = currentMillis;
    }
  }

  // Baseline transmission: if the baseline interval has elapsed, send sensor data regardless of threshold
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

// ------------------ Backend Data Transmission ------------------
void sendDataToBackend(int soilMoisture, float temperature, float humidity) {
  // Validate sensor readings
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

  // Create JSON payload with sensor data
  StaticJsonDocument<200> jsonDoc;
  jsonDoc["soilmoisture"] = soilMoisture;
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = humidity;

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
  }
  http.end();

  // Update last sent sensor values
  lastSoilMoisture = soilMoisture;
  lastTemperature = temperature;
  lastHumidity = humidity;
}

// ------------------ Web Server Handlers ------------------
void handlePortal() {
  if (server.method() == HTTP_POST) {
    strncpy(user_wifi.ssid, server.arg("ssid").c_str(), sizeof(user_wifi.ssid) - 1);
    strncpy(user_wifi.password, server.arg("password").c_str(), sizeof(user_wifi.password) - 1);
    user_wifi.ssid[sizeof(user_wifi.ssid) - 1] = '\0';
    user_wifi.password[sizeof(user_wifi.password) - 1] = '\0';

    EEPROM.put(0, user_wifi);
    EEPROM.commit();

    server.send(200, "text/html", "<h1>Wi-Fi credentials saved. Restarting device...</h1>");
    delay(2000);
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
        </body>
      </html>
    )rawliteral");
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