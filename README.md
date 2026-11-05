# Forecast at glance (`ha-forecast-card`)

Home Assistant Lovelace card to preview the weather forecast (hourly / 7 days) and key weather attributes (humidity, wind, UV) with a temperature line over rain bars.

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
| `default_view`      | `hourly` \| `daily` | `hourly` | Tab shown first                                     |
| `hours_to_show`     | integer             | `10`     | Hourly slots                                        |
| `days_to_show`      | integer             | `7`      | Daily slots                                         |
| `temperature_entity`| string              |          | Sensor overriding the current temperature (realtime)|
| `humidity_entity`   | string              |          | Sensor overriding humidity                          |
| `wind_speed_entity` | string              |          | Sensor overriding wind speed                        |
| `uv_index_entity`   | string              |          | Sensor overriding UV index                          |
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

## License

GPL-3.0
