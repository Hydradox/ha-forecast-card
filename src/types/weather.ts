/** Weather entity feature bitmask (homeassistant.components.weather.WeatherEntityFeature). */
export const WeatherFeature = {
  ForecastDaily: 1,
  ForecastHourly: 2,
  ForecastTwiceDaily: 4,
} as const;

export type ForecastType = "daily" | "hourly" | "twice_daily";

/** One forecast entry as delivered by `weather/subscribe_forecast`. */
export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
  wind_speed?: number;
  wind_bearing?: number | string;
  humidity?: number;
  uv_index?: number;
  is_daytime?: boolean;
}

export interface ForecastEvent {
  type: ForecastType;
  forecast: ForecastEntry[] | null;
}
