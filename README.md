# Forecast at glance (`ha-forecast-card`)

Home Assistant Lovelace card to preview the weather forecast (hourly / daily) and key weather attributes (humidity, wind, UV) with a temperature line over rain bars.

> **Status:** project scaffolding. The card currently renders the header; chart, tabs and attribute strip are in progress.

## Installation

### HACS (recommended)

1. HACS → Dashboard → ⋮ → *Custom repositories* → add this repository, category **Dashboard**.
2. Install **Forecast at glance** and reload the browser.

### Manual

1. Download `ha-forecast-card.js` from the latest release into `config/www/`.
2. Settings → Dashboards → Resources → add `/local/ha-forecast-card.js` as **JavaScript module**.
   (With HACS the resource is `/hacsfiles/ha-forecast-card/ha-forecast-card.js`.)

## Configuration

```yaml
type: custom:ha-forecast-card
entity: weather.home
```

| Option              | Type                | Default  | Description                                         |
| ------------------- | ------------------- | -------- | --------------------------------------------------- |
| `entity`            | string (required)   |          | `weather.*` entity                                  |
| `name`              | string              | entity   | Card title                                          |
| `show_name`         | boolean             | `true`   | Show the name line                                  |
| `default_view`      | `hourly` \| `daily` | `hourly` | Tab shown first                                     |
| `hours_to_show`     | integer             | `10`     | Hourly slots                                        |
| `days_to_show`      | integer             | `7`      | Daily slots                                         |
| `temperature_entity`| string              |          | Sensor overriding the current temperature (realtime)|
| `humidity_entity`   | string              |          | Sensor overriding humidity                          |
| `wind_speed_entity` | string              |          | Sensor overriding wind speed                        |
| `uv_index_entity`   | string              |          | Sensor overriding UV index                          |
| `cold_threshold`    | number              | `0` °C / `32` °F | Temperature at or below which the colour is fully cold. In your Home Assistant unit |
| `hot_threshold`     | number              | `35` °C / `95` °F | Temperature at or above which the colour is fully hot. In your Home Assistant unit |
| `tap_action`        | action              | `more-info` | Tap on the card (weather entity)                 |
| `temperature_tap_action` | action         | `more-info` | Tap on the temperature: history of `temperature_entity`, or the weather entity if unset |
| `language`          | string              | HA UI    | Force a language (`en`, `es`, …)                    |

## Theming

The card uses only Home Assistant theme variables, so light/dark and custom themes (e.g. Mushroom) apply automatically. Every colour is exposed as a `--hfc-*` variable (see `src/styles/tokens.ts`) for overrides.

## Development

```bash
npm install
npm start          # vite dev server
npm run watch      # rebuild dist/ha-forecast-card.js on change
npm run build      # production bundle
npm run typecheck && npm run lint && npm test
```

### Try it in a real Home Assistant (Podman)

```bash
npm run build         # or keep `npm run watch` running
npm run dev:ha        # starts HA on http://localhost:8123 and sets everything up
```

Log in with `dev` / `dev`. The script registers the card as a dashboard resource, creates a "Forecast dev" dashboard with several card variants and adds template weather entities (`weather.dev_weather`, `weather.dev_weather_daily_only`) plus sensors, driven by input helpers (condition, temperature, humidity, wind, UV, rain) so you can change the fake weather live. Two custom themes (`Dev Warm`, `Dev Mono`) are available in your profile to check theming; switch to dark mode there too. To test °F, set the unit system to US customary in Settings → General.

After rebuilding, run `npm run dev:ha` again (it is idempotent and busts the cache) or hard-reload the browser. Other commands: `npm run dev:ha:logs`, `npm run dev:ha:down`, `npm run dev:ha:reset` (wipes the dev HA state). Set `HA_PORT` / `HA_IMAGE` to override the port or image. The throwaway state lives in `dev/config` (git-ignored).

## License

GPL-3.0
