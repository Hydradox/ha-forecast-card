# Forecast at glance

A Home Assistant Lovelace card that shows the weather forecast at a glance: a temperature line over rain bars, hourly or daily, plus humidity, wind and UV with a 5-level scale each.

<table align="center">
  <tr>
    <th></th>
    <th>Hourly</th>
    <th>Daily</th>
  </tr>
  <tr>
    <th>Dark</th>
    <td><img src="docs/images/hourly-dark.png" alt="Hourly forecast, dark theme" height="300"></td>
    <td><img src="docs/images/daily-dark.png" alt="Daily forecast, dark theme" height="300"></td>
  </tr>
  <tr>
    <th>Light</th>
    <td><img src="docs/images/hourly-light.png" alt="Hourly forecast, light theme" height="300"></td>
    <td><img src="docs/images/daily-light.png" alt="Daily forecast, light theme" height="300"></td>
  </tr>
</table>

> **AI-assisted project.** This card is designed and written with the help of an AI assistant. It has automated tests and runs against a real Home Assistant during development.

## Features

- **Hourly and daily forecasts** with a temperature line, rain bars and weather icons. The hourly chart scrolls horizontally (drag with the mouse, swipe on touch).
- **Realtime**: forecasts arrive by subscription (`weather/subscribe_forecast`), so there is no polling, and the card only re-renders when its entities change.
- **Humidity, wind and UV** with a level label and a 5-segment scale.
- **Temperature colours** for the header icon and the chart line, with configurable cold and hot thresholds.
- **Per-value sensor overrides**: use your own sensors for temperature, humidity, wind speed or UV and get their updates in realtime.
- **Tap actions** on the card and on the temperature (by default, the temperature opens the sensor history).
- **Visual editor** for every option, and everything is also available in YAML.
- **Themes**: only Home Assistant theme variables are used, so light, dark and custom themes apply automatically.
- **Languages**: English and Spanish. Dates, times and numbers follow your Home Assistant locale and units.

## Requirements

- Home Assistant **2023.9** or newer.
- A `weather.*` entity that provides hourly and/or daily forecasts. The tabs shown depend on what the integration supports: with only one of them, the card shows that view without tabs.

## Installation

### HACS

1. In HACS, open the three-dot menu → **Custom repositories**.
2. Add `https://github.com/Hydradox/ha-forecast-card` with type **Dashboard**.
3. Search for **Forecast at glance**, download it and reload your browser.

HACS adds the dashboard resource for you.

### Manual

1. Download `ha-forecast-card.js` from the [latest release](https://github.com/Hydradox/ha-forecast-card/releases/latest) into `config/www/`.
2. Go to **Settings → Dashboards → ⋮ → Resources** and add `/local/ha-forecast-card.js` as a **JavaScript module**.
3. Reload your browser.

## Usage

Add the card from the card picker (search for "Forecast at glance") and use the visual editor, or use YAML:

```yaml
type: custom:ha-forecast-card
entity: weather.home
```

Full example:

```yaml
type: custom:ha-forecast-card
entity: weather.home
name: Home
default_view: daily
hours_to_show: 12
temperature_entity: sensor.outdoor_temperature
humidity_entity: sensor.outdoor_humidity
cold_threshold: 5
hot_threshold: 30
tap_action:
  action: navigate
  navigation_path: /lovelace/weather
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | **required** | The `weather.*` entity providing conditions and forecasts. |
| `name` | string | entity name | Name shown above the condition. |
| `show_name` | boolean | `true` | Show or hide the name line. |
| `default_view` | `hourly` \| `daily` | `hourly` | Tab shown first. Falls back to the other one if the integration lacks it. |
| `hours_to_show` | integer ≥ 1 | `10` | Hourly columns, counting the "Now" column. |
| `days_to_show` | integer ≥ 1 | `7` | Daily columns. |
| `temperature_entity` | entity id | | Sensor used for the current temperature instead of the weather entity. |
| `humidity_entity` | entity id | | Sensor used for humidity. |
| `wind_speed_entity` | entity id | | Sensor used for wind speed (its unit is respected). |
| `uv_index_entity` | entity id | | Sensor used for the UV index. |
| `cold_threshold` | number | `0` °C / `32` °F | At or below this temperature the colour is fully cold (blue). |
| `hot_threshold` | number | `35` °C / `95` °F | At or above this temperature the colour is fully hot (red). Must be greater than `cold_threshold`. |
| `tap_action` | action | `more-info` | What tapping the card does. Opens the weather entity by default. |
| `temperature_tap_action` | action | `more-info` | What tapping the temperature does. Opens the history of `temperature_entity`, or the weather entity if none is set. |
| `language` | string | Home Assistant language | Force a language (`en`, `es`). |

**Thresholds** are in your Home Assistant temperature unit. Leave them out to use the defaults, which follow the unit system.

**Actions** support `more-info`, `navigate`, `url`, `toggle`, `perform-action` and `none`. Only tap is supported (no hold or double tap yet).

**Missing data** is handled gracefully: humidity, wind and UV only appear when a value exists, and rain falls back to precipitation probability if the integration provides no amounts.

### Scales

The level shown for each metric uses fixed ranges:

| Level | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Humidity (%) | < 30 | < 40 | < 60 | < 80 | ≥ 80 |
| Wind (km/h) | < 20 | < 40 | < 60 | < 90 | ≥ 90 |
| UV index | < 3 | < 6 | < 8 | < 11 | ≥ 11 |

Wind in other units is converted before choosing the level.

## Theming

The card uses only Home Assistant theme variables (`--primary-text-color`, `--ha-card-background`, `--divider-color`, …), so it follows your theme with no extra setup. Colours are exposed as `--hfc-*` variables if you want to adjust them, for example with [card-mod](https://github.com/thomasloven/lovelace-card-mod):

```yaml
type: custom:ha-forecast-card
entity: weather.home
card_mod:
  style: |
    :host {
      --hfc-rain: var(--teal-color);
      --hfc-sun-fill: orange;
    }
```

The full list of variables is in [`src/styles/tokens.ts`](src/styles/tokens.ts).

## Troubleshooting

- **"Custom element doesn't exist: ha-forecast-card"**: the resource isn't loaded. Check that it is listed under **Settings → Dashboards → Resources**, then hard-reload the browser (Ctrl+Shift+R).
- **No forecast, only the header**: the integration doesn't support hourly or daily forecasts, or it hasn't delivered them yet.
- **The card didn't change after an update**: clear the browser cache or hard-reload. Home Assistant serves `/local` files with a long cache time.
- **Temperature colours look wrong**: check that `hot_threshold` is greater than `cold_threshold` and that both are in your Home Assistant unit.

## Development

```bash
npm install
npm run watch      # rebuild dist/ha-forecast-card.js on change
npm run build      # production bundle
npm run typecheck && npm run lint && npm test
```

### Try it in a real Home Assistant (Podman)

```bash
npm run build         # or keep `npm run watch` running
npm run dev:ha        # starts Home Assistant on http://localhost:8123 and sets everything up
```

Log in with `dev` / `dev`. The script registers the card as a dashboard resource, creates a "Forecast dev" dashboard with several card variants, and adds template weather entities (`weather.dev_weather`, `weather.dev_weather_daily_only`) plus sensors, driven by input helpers (condition, temperature, humidity, wind, UV, rain) so you can change the fake weather live. Two custom themes (`Dev Warm`, `Dev Mono`) are available in your profile. To test °F, set the unit system to US customary in Settings → General.

After rebuilding, run `npm run dev:ha` again (it is safe to repeat and busts the cache) or hard-reload the browser. Other commands: `npm run dev:ha:logs`, `npm run dev:ha:down` and `npm run dev:ha:reset` (wipes the dev Home Assistant state). Set `HA_PORT` or `HA_IMAGE` to change the port or image. The state lives in `dev/config` and is git-ignored.

### Contributing

Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages and PR titles (`feat:`, `fix:`, …). Releases, versions and the changelog are generated automatically from them. To add a language, add `src/localize/translations/<lang>.json` and register it in `src/localize/index.ts`.

## License

[GPL-3.0-or-later](LICENSE)
