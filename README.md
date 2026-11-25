# SkyCast — Weather & Forecast App

A responsive weather and 7-day forecast web app powered by the free [Open-Meteo API](https://open-meteo.com/) (no API key required).

## Features
- **City Search & Autocomplete** via Open-Meteo Geocoding API
- **Current Weather** (temperature, feels-like, humidity, wind, UV index, pressure, precipitation, high/low)
- **24-Hour Hourly Forecast** with precipitation probability
- **7-Day Forecast** with visual min/max temperature range bars
- **My Location** button using browser Geolocation + reverse geocoding
- **°C / °F Toggle** and **Recent Cities** saved in `localStorage`
- **Dynamic Themes** that adapt to day/night and current weather conditions

## Run Locally
Serve the `weather-app` directory with any static server, for example:

```powershell
cd weather-app
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.
