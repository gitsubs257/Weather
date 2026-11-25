const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_GEO_API = 'https://nominatim.openstreetmap.org/reverse';

const STORAGE_UNIT_KEY = 'skycast_unit';
const STORAGE_RECENT_KEY = 'skycast_recent_cities';
const MAX_RECENT = 5;

const state = {
  unit: localStorage.getItem(STORAGE_UNIT_KEY) === 'F' ? 'F' : 'C',
  location: null,
  weatherData: null,
  recentCities: loadRecentCities(),
  watchId: null,
  isTracking: false,
  lastTrackedCoords: null,
};

const els = {
  searchForm: document.getElementById('search-form'),
  cityInput: document.getElementById('city-input'),
  suggestions: document.getElementById('suggestions'),
  geoBtn: document.getElementById('geo-btn'),
  geoBtnLabel: document.getElementById('geo-btn-label'),
  unitBtns: document.querySelectorAll('.unit-btn'),
  recentCities: document.getElementById('recent-cities'),
  statusBanner: document.getElementById('status-banner'),
  dashboard: document.getElementById('dashboard'),
  locationName: document.getElementById('location-name'),
  locationMeta: document.getElementById('location-meta'),
  currentTemp: document.getElementById('current-temp'),
  conditionText: document.getElementById('condition-text'),
  feelsLike: document.getElementById('feels-like'),
  currentIcon: document.getElementById('current-icon'),
  metricHumidity: document.getElementById('metric-humidity'),
  metricWind: document.getElementById('metric-wind'),
  metricUv: document.getElementById('metric-uv'),
  metricPressure: document.getElementById('metric-pressure'),
  metricPrecip: document.getElementById('metric-precip'),
  metricHiLow: document.getElementById('metric-hilow'),
  hourlyStrip: document.getElementById('hourly-strip'),
  dailyList: document.getElementById('daily-list'),
  lastUpdated: document.getElementById('last-updated'),
};

function loadRecentCities() {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentCity(loc) {
  const filtered = state.recentCities.filter(
    (c) => !(c.name === loc.name && c.country === loc.country)
  );
  state.recentCities = [loc, ...filtered].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(state.recentCities));
  } catch {
    // Ignore storage quota errors
  }
  renderRecentCities();
}

function renderRecentCities() {
  if (!state.recentCities.length) {
    els.recentCities.hidden = true;
    return;
  }
  els.recentCities.hidden = false;
  els.recentCities.innerHTML = '';
  state.recentCities.forEach((city) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-pill';
    btn.textContent = city.country ? `${city.name}, ${city.country}` : city.name;
    btn.addEventListener('click', () => {
      stopDeviceTracking();
      loadWeatherForLocation(city);
    });
    els.recentCities.appendChild(btn);
  });
}

function showStatus(message, isError = false) {
  els.statusBanner.textContent = message;
  els.statusBanner.classList.toggle('error', isError);
  els.statusBanner.hidden = false;
}

function hideStatus() {
  els.statusBanner.hidden = true;
}

function formatTemp(celsius) {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return '--°';
  const value = state.unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(value)}°`;
}

function formatWind(kmh) {
  if (kmh === null || kmh === undefined) return '--';
  if (state.unit === 'F') {
    return `${Math.round(kmh * 0.621371)} mph`;
  }
  return `${Math.round(kmh)} km/h`;
}

function getWeatherInfo(code, isDay = 1) {
  const map = {
    0: { label: 'Clear sky', icon: isDay ? '☀️' : '🌙', theme: isDay ? 'theme-clear-day' : 'theme-clear-night' },
    1: { label: 'Mainly clear', icon: isDay ? '🌤️' : '🌙', theme: isDay ? 'theme-clear-day' : 'theme-clear-night' },
    2: { label: 'Partly cloudy', icon: isDay ? '⛅' : '☁️', theme: 'theme-cloudy' },
    3: { label: 'Overcast', icon: '☁️', theme: 'theme-cloudy' },
    45: { label: 'Fog', icon: '🌫️', theme: 'theme-cloudy' },
    48: { label: 'Depositing rime fog', icon: '🌫️', theme: 'theme-cloudy' },
    51: { label: 'Light drizzle', icon: '🌦️', theme: 'theme-rain' },
    53: { label: 'Moderate drizzle', icon: '🌦️', theme: 'theme-rain' },
    55: { label: 'Dense drizzle', icon: '🌧️', theme: 'theme-rain' },
    56: { label: 'Freezing drizzle', icon: '🌧️', theme: 'theme-rain' },
    57: { label: 'Dense freezing drizzle', icon: '🌧️', theme: 'theme-rain' },
    61: { label: 'Slight rain', icon: '🌦️', theme: 'theme-rain' },
    63: { label: 'Moderate rain', icon: '🌧️', theme: 'theme-rain' },
    65: { label: 'Heavy rain', icon: '🌧️', theme: 'theme-rain' },
    66: { label: 'Freezing rain', icon: '🌧️', theme: 'theme-rain' },
    67: { label: 'Heavy freezing rain', icon: '🌧️', theme: 'theme-rain' },
    71: { label: 'Slight snow', icon: '🌨️', theme: 'theme-snow' },
    73: { label: 'Moderate snow', icon: '❄️', theme: 'theme-snow' },
    75: { label: 'Heavy snow', icon: '❄️', theme: 'theme-snow' },
    77: { label: 'Snow grains', icon: '🌨️', theme: 'theme-snow' },
    80: { label: 'Slight rain showers', icon: '🌦️', theme: 'theme-rain' },
    81: { label: 'Moderate rain showers', icon: '🌧️', theme: 'theme-rain' },
    82: { label: 'Violent rain showers', icon: '⛈️', theme: 'theme-storm' },
    85: { label: 'Slight snow showers', icon: '🌨️', theme: 'theme-snow' },
    86: { label: 'Heavy snow showers', icon: '❄️', theme: 'theme-snow' },
    95: { label: 'Thunderstorm', icon: '⛈️', theme: 'theme-storm' },
    96: { label: 'Thunderstorm with hail', icon: '⛈️', theme: 'theme-storm' },
    99: { label: 'Severe thunderstorm', icon: '⛈️', theme: 'theme-storm' },
  };
  return map[code] || { label: 'Unknown', icon: '🌡️', theme: 'theme-cloudy' };
}

function applyTheme(themeClass) {
  document.body.className = themeClass;
}

async function searchCities(query) {
  const url = `${GEOCODING_API}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding service unavailable');
  const data = await res.json();
  return (data.results || []).map((item) => ({
    name: item.name,
    admin1: item.admin1 || '',
    country: item.country || '',
    latitude: item.latitude,
    longitude: item.longitude,
  }));
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'surface_pressure',
      'wind_speed_10m',
    ].join(','),
    hourly: ['temperature_2m', 'precipitation_probability', 'weather_code', 'is_day'].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'uv_index_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
  });

  const res = await fetch(`${FORECAST_API}?${params.toString()}`);
  if (!res.ok) throw new Error('Weather forecast service unavailable');
  return res.json();
}

async function loadWeatherForLocation(loc, saveRecent = true) {
  showStatus(`Loading forecast for ${loc.name}...`);
  els.suggestions.hidden = true;

  try {
    const data = await fetchForecast(loc.latitude, loc.longitude);
    state.location = loc;
    state.weatherData = data;
    if (saveRecent) {
      saveRecentCity(loc);
    }
    hideStatus();
    renderDashboard();
  } catch (err) {
    showStatus(err.message || 'Failed to load weather data. Please try again.', true);
  }
}

function renderDashboard() {
  if (!state.weatherData || !state.location) return;

  const { current, hourly, daily, timezone_abbreviation: tzAbbr } = state.weatherData;
  const info = getWeatherInfo(current.weather_code, current.is_day);

  applyTheme(info.theme);
  els.dashboard.hidden = false;

  // Location & Current
  const metaParts = [state.location.admin1, state.location.country].filter(Boolean);
  els.locationName.textContent = state.location.name;
  els.locationMeta.textContent = metaParts.length
    ? `${metaParts.join(', ')} • ${tzAbbr || 'Local time'}`
    : tzAbbr || 'Local time';

  els.currentTemp.textContent = formatTemp(current.temperature_2m);
  els.conditionText.textContent = info.label;
  els.feelsLike.textContent = `Feels like ${formatTemp(current.apparent_temperature)}`;
  els.currentIcon.textContent = info.icon;

  els.metricHumidity.textContent = `${current.relative_humidity_2m}%`;
  els.metricWind.textContent = formatWind(current.wind_speed_10m);
  els.metricUv.textContent = daily.uv_index_max?.[0] !== undefined ? daily.uv_index_max[0].toFixed(1) : '--';
  els.metricPressure.textContent = `${Math.round(current.surface_pressure)} hPa`;
  els.metricPrecip.textContent = `${current.precipitation} mm`;
  els.metricHiLow.textContent = `${formatTemp(daily.temperature_2m_max[0])} / ${formatTemp(daily.temperature_2m_min[0])}`;

  renderHourly(hourly, current.time);
  renderDaily(daily);

  const now = new Date();
  els.lastUpdated.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderHourly(hourly, currentIsoTime) {
  els.hourlyStrip.innerHTML = '';
  const currentPrefix = currentIsoTime.slice(0, 13);
  let startIndex = hourly.time.findIndex((t) => t.startsWith(currentPrefix));
  if (startIndex < 0) startIndex = 0;

  const sliceEnd = Math.min(startIndex + 24, hourly.time.length);
  for (let i = startIndex; i < sliceEnd; i++) {
    const timeStr = hourly.time[i];
    const hourLabel = i === startIndex ? 'Now' : timeStr.slice(11, 16);
    const info = getWeatherInfo(hourly.weather_code[i], hourly.is_day[i]);
    const precipProb = hourly.precipitation_probability?.[i] ?? 0;

    const item = document.createElement('div');
    item.className = 'hour-item';
    item.innerHTML = `
      <span class="hour-time">${hourLabel}</span>
      <span class="hour-icon" aria-hidden="true">${info.icon}</span>
      <span class="hour-temp">${formatTemp(hourly.temperature_2m[i])}</span>
      <span class="hour-precip">${precipProb > 0 ? `💧 ${precipProb}%` : ''}</span>
    `;
    els.hourlyStrip.appendChild(item);
  }
}

function renderDaily(daily) {
  els.dailyList.innerHTML = '';
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = Math.max(weekMax - weekMin, 1);

  daily.time.forEach((dateStr, idx) => {
    const date = new Date(`${dateStr}T12:00:00`);
    const dayLabel = idx === 0
      ? 'Today'
      : date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const info = getWeatherInfo(daily.weather_code[idx], 1);
    const minT = daily.temperature_2m_min[idx];
    const maxT = daily.temperature_2m_max[idx];
    const precipMax = daily.precipitation_probability_max?.[idx] ?? 0;

    const leftPct = ((minT - weekMin) / span) * 100;
    const widthPct = Math.max(((maxT - minT) / span) * 100, 6);

    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <span class="day-name">${dayLabel}</span>
      <span class="day-icon" aria-hidden="true">${info.icon}</span>
      <span class="day-desc">${info.label}</span>
      <span class="day-precip">${precipMax > 0 ? `💧 ${precipMax}%` : ''}</span>
      <div class="day-temps">
        <span class="temp-min">${formatTemp(minT)}</span>
        <div class="temp-bar-track">
          <div class="temp-bar-fill" style="left: ${leftPct.toFixed(1)}%; width: ${widthPct.toFixed(1)}%;"></div>
        </div>
        <span class="temp-max">${formatTemp(maxT)}</span>
      </div>
    `;
    els.dailyList.appendChild(row);
  });
}

// Event Listeners
let debounceTimer = null;
els.cityInput.addEventListener('input', () => {
  const query = els.cityInput.value.trim();
  clearTimeout(debounceTimer);
  if (query.length < 2) {
    els.suggestions.hidden = true;
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const results = await searchCities(query);
      if (!results.length) {
        els.suggestions.hidden = true;
        return;
      }
      els.suggestions.innerHTML = '';
      results.forEach((loc) => {
        const li = document.createElement('li');
        const sub = [loc.admin1, loc.country].filter(Boolean).join(', ');
        li.innerHTML = `<span>${loc.name}</span><span class="suggestion-sub">${sub}</span>`;
        li.addEventListener('click', () => {
          stopDeviceTracking();
          els.cityInput.value = loc.name;
          loadWeatherForLocation(loc);
        });
        els.suggestions.appendChild(li);
      });
      els.suggestions.hidden = false;
    } catch {
      els.suggestions.hidden = true;
    }
  }, 260);
});

document.addEventListener('click', (e) => {
  if (!els.searchForm.contains(e.target)) {
    els.suggestions.hidden = true;
  }
});

els.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = els.cityInput.value.trim();
  if (!query) return;

  showStatus(`Searching for "${query}"...`);
  try {
    const results = await searchCities(query);
    if (!results.length) {
      showStatus(`No matching city found for "${query}". Try another name.`, true);
      return;
    }
    stopDeviceTracking();
    await loadWeatherForLocation(results[0]);
  } catch (err) {
    showStatus(err.message || 'Search failed. Check your connection.', true);
  }
});

els.unitBtns.forEach((btn) => {
  btn.classList.toggle('active', btn.dataset.unit === state.unit);
  btn.addEventListener('click', () => {
    const nextUnit = btn.dataset.unit;
    if (nextUnit === state.unit) return;
    state.unit = nextUnit;
    localStorage.setItem(STORAGE_UNIT_KEY, nextUnit);
    els.unitBtns.forEach((b) => b.classList.toggle('active', b.dataset.unit === state.unit));
    renderDashboard();
  });
});

function setTrackingUI(active) {
  state.isTracking = active;
  els.geoBtn.classList.toggle('tracking', active);
  els.geoBtn.setAttribute('aria-pressed', String(active));
  els.geoBtnLabel.textContent = active ? 'Tracking Live' : 'Track Location';
  els.geoBtn.title = active ? 'Stop tracking device location' : 'Track my device location';
}

function stopDeviceTracking() {
  if (state.watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  state.lastTrackedCoords = null;
  setTrackingUI(false);
}

function hasMovedSignificantly(prev, lat, lon) {
  if (!prev) return true;
  // ~0.01 deg is roughly 1.1 km; avoids redundant API calls from GPS jitter
  return Math.abs(prev.latitude - lat) > 0.01 || Math.abs(prev.longitude - lon) > 0.01;
}

async function resolveDeviceLocation(latitude, longitude) {
  const loc = {
    name: 'Current Location',
    admin1: '',
    country: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    latitude,
    longitude,
  };
  try {
    const res = await fetch(
      `${REVERSE_GEO_API}?format=jsonv2&lat=${latitude}&lon=${longitude}`
    );
    if (res.ok) {
      const geo = await res.json();
      const addr = geo.address || {};
      loc.name = addr.city || addr.town || addr.village || addr.county || 'Current Location';
      loc.admin1 = addr.state || '';
      loc.country = addr.country || '';
    }
  } catch {
    // Fallback to coordinate label
  }
  return loc;
}

function loadFallbackCity() {
  const fallback = state.recentCities[0] || {
    name: 'New York',
    admin1: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.006,
  };
  loadWeatherForLocation(fallback, false);
}

function startDeviceTracking(fallbackOnError = false) {
  if (!navigator.geolocation) {
    if (fallbackOnError) {
      loadFallbackCity();
    } else {
      showStatus('Geolocation is not supported by your browser.', true);
    }
    return;
  }

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
  }

  setTrackingUI(true);
  if (!state.weatherData) {
    showStatus('Tracking your device location...');
  }

  let handledInitialFallback = false;

  state.watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      if (!hasMovedSignificantly(state.lastTrackedCoords, latitude, longitude)) {
        return;
      }
      state.lastTrackedCoords = { latitude, longitude };
      const loc = await resolveDeviceLocation(latitude, longitude);
      await loadWeatherForLocation(loc);
    },
    (err) => {
      stopDeviceTracking();
      if (fallbackOnError && !handledInitialFallback) {
        handledInitialFallback = true;
        loadFallbackCity();
        return;
      }
      const msg =
        err.code === 1
          ? 'Location permission denied. Allow location access or search for a city.'
          : 'Unable to track your device location. Please search for a city instead.';
      showStatus(msg, true);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 10000,
    }
  );
}

els.geoBtn.addEventListener('click', () => {
  if (state.isTracking) {
    stopDeviceTracking();
  } else {
    startDeviceTracking(false);
  }
});

// Initialize
renderRecentCities();
startDeviceTracking(true);
