import { fetchWeatherApi } from "openmeteo";

// Third-party npm packages
import express from "express";
import cors from "cors";

// Built-in Node.js modules (using the 'node:' prefix is the modern standard)
/* import https from 'node:https';
import fs from 'node:fs'; */
const app = express();

const PORT = process.env.PORT || 4000;
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// CORS options to allow only specific origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedHosts = ["localhost", "72.61.242.106"];
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      if (allowedHosts.includes(url.hostname)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    } catch (err) {
      callback(new Error("Invalid origin"));
    }
  },
};

// Middleware to parse JSON bodies
app.use(express.json());

// Use CORS middleware
app.use(cors(corsOptions));

// Route for reverse geocoding
app.get("/reverse-geo", async (req, res) => {
  const { lat, lng } = req.query;

  // Validate input
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "Latitude and longitude are required" });
  }

  // Mock reverse geocoding response
  // In a real application, you would integrate with a geocoding service like OpenCage, Google Maps, etc.
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    {
      headers: {
        "User-Agent": "weather-app/1.0 (support@amitdubey.cloud)",
      },
    },
  );

  res.json(await response.json());
});

app.get("/weather", async (req, res) => {
  const { lat, lng } = req.query;

  // Validate input
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "Latitude and longitude are required" });
  }

  // Fetch weather data from Open-Meteo API
  try {
    const weatherResponse = await fetchWeatherApi(OPEN_METEO_URL, {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      daily: ["weather_code", "temperature_2m_max", "temperature_2m_min"],
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "weather_code",
        "rain",
        "showers",
        "snowfall",
      ],
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "wind_speed_10m",
        "precipitation",
      ],
    });

    // Process the response (assuming single location)
    const response = weatherResponse[0];

    // Helper function to form time ranges
    const range = (start, stop, step) =>
      Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

    const utcOffsetSeconds = response.utcOffsetSeconds();

    const current = response.current();
    const hourly = response.hourly();
    const daily = response.daily();

    const weatherData = {
      latitude: response.latitude(),
      longitude: response.longitude(),
      elevation: response.elevation(),
      utc_offset_seconds: utcOffsetSeconds,
      timezone: response.timezone(),
      timezone_abbreviation: response.timezoneAbbreviation(),
      current: {
        time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
        temperature_2m: current.variables(0).value(),
        relative_humidity_2m: current.variables(1).value(),
        apparent_temperature: current.variables(2).value(),
        wind_speed_10m: current.variables(3).value(),
        precipitation: current.variables(4).value(),
      },
      hourly: {
        time: range(
          Number(hourly.time()),
          Number(hourly.timeEnd()),
          hourly.interval(),
        ).map((t) => new Date((t + utcOffsetSeconds) * 1000)),
        temperature_2m: hourly.variables(0).valuesArray(),
        relative_humidity_2m: hourly.variables(1).valuesArray(),
        weather_code: hourly.variables(2).valuesArray(),
        rain: hourly.variables(3).valuesArray(),
        showers: hourly.variables(4).valuesArray(),
        snowfall: hourly.variables(5).valuesArray(),
      },
      daily: {
        time: range(
          Number(daily.time()),
          Number(daily.timeEnd()),
          daily.interval(),
        ).map((t) => new Date((t + utcOffsetSeconds) * 1000)),
        weather_code: daily.variables(0).valuesArray(),
        temperature_2m_max: daily.variables(1).valuesArray(),
        temperature_2m_min: daily.variables(2).valuesArray(),
      },
    };

    res.json(weatherData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSL options for HTTPS
/* const sslOptions = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
}; */

// Start the HTTPS server
app.listen(PORT, () => {
  console.log(`Server is running on https port ${PORT}`);
});
