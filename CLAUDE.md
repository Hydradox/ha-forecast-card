# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

`ha-forecast-card` is a Home Assistant Lovelace custom card that previews weather forecasts and key weather attributes. It is distributed through GitHub and HACS (Dashboard/"plugin" category). The card renders the header (condition icon, name, state, max/min, temperature), Hourly/Daily tabs, the temperature line over precipitation bars, and the humidity/wind/UV strip. Not yet verified visually inside a real Home Assistant (dev environment is planned for the end).

**Design source of truth:** the Claude artifact "Tarjeta de tiempo y clima", page "C4 v2a · Estados" (boards E1–E6): header with icon circle tinted by temperature, Hourly/Daily tabs, temperature line over rain bars, and a humidity/wind/UV strip where each metric shows a 5-level scale bar. Defaults to English (US); Spanish is also shipped.

## Stack and commands

TypeScript + Lit (no decorators: `static properties` + `declare` fields), Vite library build to one ES file, Vitest (happy-dom), ESLint flat config.

- `npm run build`: production bundle to `dist/ha-forecast-card.js`
- `npm run watch` / `npm start`: rebuild on change / Vite dev server
- `npm run typecheck`, `npm run lint`, `npm test` (single test: `npx vitest run test/scales.test.ts -t "name"`)

## Layout

- `src/ha-forecast-card.ts`: card element, `shouldUpdate` filtering, `customCards` registration
- `src/editor/`: `ha-form` visual editor
- `src/views/`: render functions (no extra custom elements): `icons.ts` (SVG sprite + condition→icon), `chart.ts` (hourly/daily SVG chart), `attributes.ts` (humidity/wind/UV strip)
- `src/utils/forecast-view.ts` (slot selection, scales, rain bars) and `format.ts` (Intl formatters, cached): pure and tested
- `src/controllers/forecast-subscription.ts`: `weather/subscribe_forecast` lifecycle (ReactiveController)
- `src/config.ts`: config types, defaults, `parseConfig` validation
- `src/localize/`: `createTranslator`; add a language by adding `translations/<lang>.json` and registering it in `index.ts`
- `src/utils/`: pure, unit-tested logic (`scales.ts` level thresholds, `temperature.ts` colour ramp, `units.ts`)
- `src/styles/tokens.ts`: `--hfc-*` variables derived from HA theme variables; all colours go through these
- `test/`: Vitest specs. Keep logic in `utils/` so it stays testable without a DOM.

Unit handling: everything internal is °C. Declare defaults once in °C (`DEFAULT_THRESHOLDS_C` in `utils/temperature.ts`) and convert via `utils/units.ts`; user thresholds are stored in the HA display unit, and the editor strips values equal to the defaults (`compactConfig`) so unit-dependent defaults keep following the unit system. Actions go through `utils/actions.ts` (self-contained, no frontend internals).

Dev environment: `npm run dev:ha` runs a throwaway Home Assistant in Podman (`dev/ha.sh`, seed config in `dev/config`, onboarding and dashboard via `dev/setup.mjs`, login `dev`/`dev`). Use it, not mocks, to check visuals, themes and the editor.

Naming gotcha: do not name a field `translate` on the element, since it shadows `HTMLElement.translate`.

## Home Assistant card conventions to follow

**Card contract** (custom element registered with `customElements.define`, extending `LitElement`):
- `setConfig(config)`: validate and throw on invalid config; never touch `hass` here.
- `set hass(hass)` / `@property hass`: called on every state change of any entity; keep it cheap and only re-render when the relevant entities changed (use `shouldUpdate` comparing the specific `hass.states[...]` objects).
- `getCardSize()` (or `getGridOptions()` for the sections view) so layout works.
- `static getStubConfig()` and registration in `window.customCards` (`type`, `name`, `description`, `preview: true`) so the card shows in the card picker.
- Provide a visual editor: `static getConfigElement()` returning a `ha-form`-based editor element, with `getConfigForm()` preferred when the schema is simple. Config must also remain fully usable via YAML.

**Weather data**:
- Read current conditions and attributes from the `weather.*` entity state/attributes.
- Forecasts: modern HA (2023.9+) no longer exposes the `forecast` attribute. Use the `weather/subscribe_forecast` websocket subscription (`hass.connection.subscribeMessage`) with `forecast_type` `daily`/`hourly`/`twice_daily`, checking `supported_features` bitmask first. Unsubscribe in `disconnectedCallback`, resubscribe in `connectedCallback`/on entity change. A fallback to the `weather.get_forecasts` service is acceptable, but do not poll.

**Frontend practices**:
- Style with HA CSS variables (`--primary-text-color`, `--ha-card-background`, `--secondary-text-color`, etc.) and `ha-card`, so themes and dark mode work. No hard-coded colors.
- Use HA's own components (`ha-card`, `ha-icon`, `ha-svg-icon`, `ha-form`) and formatting helpers; localize with `hass.localize`, `hass.locale` and `hass.language`/Intl for dates, units and numbers. Respect the user's unit system (`hass.config.unit_system`) and the entity's own unit attributes.
- Ship translations for every user-facing string; do not hard-code English.
- Handle `unavailable`/`unknown` states and missing attributes gracefully.
- Keep the bundle self-contained (no runtime CDN fetches) and avoid heavy dependencies.

## CI/CD and releases

Separate workflows in `.github/workflows/`, with shared setup in `.github/actions/setup`:
- `pr-title.yml`: enforces a Conventional Commit PR title.
- `quality.yml`: parallel `typecheck`, `lint`, `test`, `build` jobs. Runs on PRs and is reused (`workflow_call`) by release.
- `hacs.yml`: `hacs/action` validation. Runs on PRs, manual dispatch, and is reused by release. No scheduled run (not needed).
- `release.yml`: on push to `main`, calls `quality` and `hacs`, then `publish` runs semantic-release (`.releaserc.json`) only if both passed.

- **Never bump versions or edit `CHANGELOG.md` by hand.** semantic-release derives the version from Conventional Commits, writes the CHANGELOG, builds, commits `chore(release): x.y.z [skip ci]`, tags `vX.Y.Z` and attaches `dist/ha-forecast-card.js` to the GitHub release.
- Commit/PR-title format: `feat:` → minor, `fix:`/`perf:` → patch, `feat!:` or a `BREAKING CHANGE:` footer → major. `docs`, `refactor` appear in the notes; `chore`, `ci`, `build`, `test`, `style` are hidden and release nothing. PR titles are enforced; use squash-merge so the title becomes the commit.
- `conventional-changelog-conventionalcommits` must stay on major 9: v10 needs a newer changelog writer than semantic-release bundles and breaks release notes.
- The first release will be `1.0.0` (no earlier tags). `__VERSION__` in the bundle comes from `package.json` at build time.
- `main` must allow the release job to push (no required-PR rule without a bypass for GitHub Actions).

## HACS / GitHub distribution requirements

- `hacs.json` at the repo root (`name`, `render_readme`, optionally `filename`).
- The built JS file must be named after the repo (`ha-forecast-card.js`) and be attached to GitHub **releases** (HACS prefers release assets over committed `dist/`). Releases use semver tags.
- README must document installation (HACS + manual), the resource URL and every config option, and must contain images (HACS `images` check). Screenshots (dark and light, hourly and daily) live in `docs/images/` and are linked with absolute `raw.githubusercontent.com/.../main/...` URLs so they render inside HACS; they 404 until merged to `main`. Keep README options in sync with `src/config.ts` and the editor.
- CI under `.github/workflows/`: build + lint + test, plus the `hacs/action` validation and a release workflow that builds and uploads the bundle.
- The GitHub repo needs a description, topics and Issues enabled to pass HACS validation (set in the repo settings; not stored in the code).
