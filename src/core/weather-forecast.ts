/**
 * Weather Forecast System — predict upcoming floor weather conditions.
 * Displayed in dungeon preview and as a HUD element.
 */

import {
  WeatherType, WEATHERS, rollFloorWeather,
  WeatherIntensity, getWeatherIntensity,
} from "./weather";

export interface WeatherForecast {
  floor: number;
  weather: WeatherType;
  intensity: WeatherIntensity;
  name: string;
  color: string;
  symbol: string;
}

/** Generate weather forecasts for the next N floors */
export function generateForecast(
  dungeonId: string,
  startFloor: number,
  count: number,
  totalFloors: number,
): WeatherForecast[] {
  const forecasts: WeatherForecast[] = [];
  for (let i = 0; i < count; i++) {
    const floor = startFloor + i;
    const weather = rollFloorWeather(dungeonId, floor);
    const intensity = getWeatherIntensity(floor, totalFloors);
    const wd = WEATHERS[weather];
    forecasts.push({
      floor,
      weather,
      intensity,
      name: weather === WeatherType.None ? "Clear" : wd?.name ?? "Unknown",
      color: wd?.color ?? "#94a3b8",
      symbol: wd?.symbol ?? "",
    });
  }
  return forecasts;
}

/** Get a compact forecast string for HUD display */
export function forecastToString(f: WeatherForecast): string {
  const intensityStr = f.intensity === WeatherIntensity.Extreme ? "!!"
    : f.intensity === WeatherIntensity.Intense ? "!" : "";
  return `B${f.floor}F: ${f.symbol}${f.name}${intensityStr}`;
}
