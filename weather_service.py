"""
SuperPlus Weather Service
Auto-pulls weather for Kingston, Jamaica using Open-Meteo (free, no API key)
Called by the agent each time it writes a row to the sheet.
"""

import requests
from datetime import datetime


# Kingston, Jamaica coordinates
LATITUDE = 17.9712
LONGITUDE = -76.7936


def get_weather_for_date(date_str: str) -> dict:
    """
    Fetch weather for a specific date.
    Returns dict with temp, condition, rain, humidity — or empty dict on failure.
    
    date_str format: "2026-01-30"
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "weathercode"
            ],
            "start_date": date_str,
            "end_date": date_str,
            "timezone": "America/Jamaica"
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        daily = data.get("daily", {})

        # Extract values (each is a list with one element for our single day)
        temp_max = daily.get("temperature_2m_max", [None])[0]
        temp_min = daily.get("temperature_2m_min", [None])[0]
        rain_mm = daily.get("precipitation_sum", [None])[0]
        wmo_code = daily.get("weathercode", [None])[0]

        condition = _wmo_to_condition(wmo_code)

        print(f"🌤️ Weather for {date_str}: {condition}, {temp_max}°C max, {rain_mm}mm rain")

        return {
            "temp_max_c": temp_max,
            "temp_min_c": temp_min,
            "rain_mm": rain_mm,
            "condition": condition
        }

    except Exception as e:
        print(f"⚠️ Weather fetch failed for {date_str}: {e}")
        return {}


def _wmo_to_condition(code: int) -> str:
    """
    Convert WMO weather code to a simple human-readable label.
    https://open-meteo.com/en/docs#weathervariables
    """
    if code is None:
        return "Unknown"

    if code == 0:
        return "Clear"
    elif code in (1, 2):
        return "Partly Cloudy"
    elif code == 3:
        return "Overcast"
    elif code in (45, 48):
        return "Foggy"
    elif code in (51, 53, 55):
        return "Drizzle"
    elif code in (56, 57):
        return "Freezing Drizzle"
    elif code in (61, 63, 65):
        return "Rain"
    elif code in (66, 67):
        return "Freezing Rain"
    elif code in (71, 73, 75):
        return "Snow"
    elif code == 77:
        return "Snow Grains"
    elif code in (80, 81, 82):
        return "Rain Showers"
    elif code in (85, 86):
        return "Snow Showers"
    elif code in (95,):
        return "Thunderstorm"
    elif code in (96, 99):
        return "Thunderstorm w/ Hail"
    else:
        return "Unknown"
