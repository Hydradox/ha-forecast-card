// Prepares the throwaway Home Assistant: onboarding, dev user, card resource and a test dashboard.
// Idempotent; run via `dev/ha.sh`. Dev credentials: dev / dev. Requires Node 22+ (global fetch/WebSocket).
const base = (process.argv[2] ?? "http://localhost:8123").replace(/\/$/, "");
const clientId = `${base}/`;
const USER = { name: "Dev", username: "dev", password: "dev", language: "en" };
const RESOURCE_URL = "/local/ha-forecast-card.js";

const json = async (path, init = {}) => {
  const response = await fetch(base + path, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
};
const post = (path, body, token) =>
  json(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

async function waitForHa() {
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(`${base}/api/onboarding`);
      if (response.status === 404) return []; // up, and onboarding is finished (HA stops serving it)
      if (response.ok) return await response.json();
    } catch {
      // not reachable yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Home Assistant did not come up in 4 minutes (see `dev/ha.sh logs`)");
}

async function exchange(code) {
  const form = new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId });
  return (await json("/auth/token", { method: "POST", body: form })).access_token;
}

async function login() {
  const flow = await post("/auth/login_flow", {
    client_id: clientId,
    handler: ["homeassistant", null],
    redirect_uri: clientId,
  });
  const result = await post(`/auth/login_flow/${flow.flow_id}`, {
    client_id: clientId,
    username: USER.username,
    password: USER.password,
  });
  if (result.type !== "create_entry") throw new Error("Dev login failed (wrong credentials? try `dev/ha.sh reset`)");
  return exchange(result.result);
}

async function onboard(steps) {
  const pending = new Set(steps.filter((s) => !s.done).map((s) => s.step));
  if (pending.has("user")) {
    await post("/api/onboarding/users", { client_id: clientId, ...USER });
    console.log("Created dev user (dev / dev)");
  }
  const token = await login();
  if (pending.has("core_config")) await post("/api/onboarding/core_config", {}, token);
  if (pending.has("analytics")) await post("/api/onboarding/analytics", {}, token);
  if (pending.has("integration")) {
    await post("/api/onboarding/integration", { client_id: clientId, redirect_uri: `${clientId}?auth_callback=1` }, token);
  }
  return token;
}

function connect(token) {
  const socket = new WebSocket(`${base.replace(/^http/, "ws")}/api/websocket`);
  let id = 0;
  const waiting = new Map();
  const ready = new Promise((resolve, reject) => {
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === "auth_required") socket.send(JSON.stringify({ type: "auth", access_token: token }));
      else if (message.type === "auth_ok") resolve();
      else if (message.type === "auth_invalid") reject(new Error("websocket auth failed"));
      else if (message.type === "result") {
        const pending = waiting.get(message.id);
        waiting.delete(message.id);
        if (message.success) pending.resolve(message.result);
        else pending.reject(new Error(JSON.stringify(message.error)));
      }
    };
    socket.onerror = reject;
  });
  const send = (payload) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      waiting.set(next, { resolve, reject });
      socket.send(JSON.stringify({ id: next, ...payload }));
    });
  return { ready, send, close: () => socket.close() };
}

// Every card follows the Festivity control (auto = by date, none, or a festivity), unless it sets its own.
const card = (extra) => ({ type: "custom:ha-forecast-card", entity: "weather.dev_weather", festivity: "input_select.dev_festivity", ...extra });
const heading = (text, icon) => ({ type: "heading", heading: text, heading_style: "title", ...(icon ? { icon } : {}) });
const controls = (title, entities) => ({ type: "entities", title, show_header_toggle: false, entities });
const section = (...cards) => ({ type: "grid", cards });

// Fixed-condition weather entities (dev/config/gallery.yaml), grouped by family.
const gallery = (entity, name) => card({ entity, name });
const GALLERY = {
  "Sky": [
    ["sunny", "Sunny"], ["clear_night", "Clear night"], ["partly_cloudy", "Partly cloudy"], ["cloudy", "Cloudy"], ["fog", "Fog"],
  ],
  "Precipitation": [
    ["rainy", "Rainy"], ["pouring", "Pouring"], ["snowy", "Snowy"], ["sleet", "Sleet"], ["hail", "Hail"],
  ],
  "Storm, wind and alerts": [
    ["thunderstorm", "Thunderstorm"], ["dry_thunderstorm", "Dry thunderstorm"], ["windy", "Windy"],
    ["windy_and_cloudy", "Windy and cloudy"], ["exceptional", "Exceptional"],
  ],
};
const LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "nl", "da", "nb", "sv", "pl"];

// Controls shared by several views (they drive weather.dev_weather).
const weatherControls = [
  controls("Weather", ["input_select.dev_condition", "input_select.dev_festivity"]),
  controls("Conditions", [
    "input_number.dev_temperature",
    "input_number.dev_humidity",
    "input_number.dev_wind",
    "input_number.dev_wind_bearing",
    "input_number.dev_uv",
    "input_number.dev_rain",
  ]),
];
const alertControls = controls("Fake alerts", [
  "input_select.dev_alert_rain",
  "input_select.dev_alert_wind",
  "input_select.dev_alert_heat",
  "input_select.dev_alert_snow",
  "input_select.dev_alert_storm",
  "input_select.dev_alert_meteoalarm",
  "input_boolean.dev_alert_ec",
  "input_select.dev_alert_custom",
]);

const view = (title, path, icon, sections) => ({ type: "sections", title, path, icon, max_columns: 4, sections });

const dashboard = {
  title: "Forecast dev",
  views: [
    // Day-to-day: controls on the left, the card to look at, then sizes and the other tab.
    view("Playground", "playground", "mdi:tune", [
      section(heading("Controls", "mdi:tune"), ...weatherControls),
      section(
        heading("Card", "mdi:weather-partly-cloudy"),
        // Showcase card (README screenshots): thresholds tuned so the colour ramp spans the visible range.
        card({ cold_threshold: 12, hot_threshold: 24 }),
        card({ name: "Daily first", default_view: "daily", cold_threshold: 12, hot_threshold: 24 }),
      ),
      section(
        heading("Sizes", "mdi:resize"),
        { type: "horizontal-stack", cards: [card({ name: "Narrow A", hours_to_show: 5 }), card({ name: "Narrow B", default_view: "daily", days_to_show: 5 })] },
        card({ name: "A name long enough to be cut off at the end of the line", hours_to_show: 6 }),
      ),
    ]),

    // One card per weather condition (and its effect), light/dark follows the profile theme.
    view("Gallery", "gallery", "mdi:view-grid", [
      section(
        heading("Festivity", "mdi:party-popper"),
        controls("Applies to every card", ["input_select.dev_festivity"]),
        { type: "markdown", content: "Switch **light/dark** in your profile (*Browser theme → Dark mode*) to check both palettes of every effect and festivity." },
      ),
      ...Object.entries(GALLERY).map(([group, items]) =>
        section(heading(group), ...items.map(([id, name]) => gallery(`weather.gallery_${id}`, name))),
      ),
    ]),

    // One card per festivity, each forced with its own `festivity` value (light/dark follows the profile theme).
    view("Festivities", "festivities", "mdi:party-popper", [
      section(
        heading("Calendar", "mdi:calendar"),
        controls("Applies to the other views", ["input_select.dev_festivity"]),
        {
          type: "markdown",
          content:
            "Automatic windows: **Fallas** Mar 15–19 · **Valentine** Feb 10–14 · **Halloween** Oct 24–Nov 1 · **Christmas** Dec 1–26 · **New Year** Dec 27–Jan 1 · **Epiphany** Jan 2–6 · **Easter** Palm Sunday–Easter Monday · **Carnival** Thursday before Shrove Tuesday to Shrove Tuesday.",
        },
        card({ name: "Automatic (today)", festivity: "auto", entity: "weather.gallery_partly_cloudy" }),
      ),
      section(
        heading("Autumn and winter", "mdi:snowflake"),
        ...[["halloween", "Halloween"], ["christmas", "Christmas"], ["new_year", "New Year's Eve"], ["epiphany", "Epiphany"]].map(([id, name]) =>
          card({ name, festivity: id, entity: "weather.gallery_partly_cloudy" }),
        ),
      ),
      section(
        heading("Spring", "mdi:flower"),
        ...[["valentine", "Valentine's Day"], ["carnival", "Carnival"], ["fallas", "Fallas"], ["easter", "Easter"]].map(([id, name]) =>
          card({ name, festivity: id, entity: "weather.gallery_partly_cloudy" }),
        ),
      ),
    ]),

    view("Layout", "layout", "mdi:page-layout-body", [
      section(heading("Controls", "mdi:tune"), ...weatherControls),
      section(
        heading("Header and tabs", "mdi:format-header-1"),
        card({ entity: "weather.dev_weather_daily_only", show_name: false, name: "Daily only, no name" }),
        card({ name: "Hourly, 6 slots, no tap action", hours_to_show: 6, tap_action: { action: "none" } }),
        card({ name: "Daily, 5 days", default_view: "daily", days_to_show: 5 }),
      ),
      section(
        heading("Narrow", "mdi:resize"),
        { type: "horizontal-stack", cards: [card({ name: "Narrow A", hours_to_show: 5 }), card({ name: "Narrow B", default_view: "daily", days_to_show: 5 })] },
        { type: "horizontal-stack", cards: [card({ name: "Tiny" }), card({ name: "Tiny", default_view: "daily" })] },
      ),
    ]),

    view("Data", "data", "mdi:database-cog", [
      section(heading("Controls", "mdi:tune"), ...weatherControls),
      section(
        heading("Sensor overrides", "mdi:thermometer"),
        card({
          name: "Sensor overrides",
          temperature_entity: "sensor.dev_outdoor_temperature",
          humidity_entity: "sensor.dev_outdoor_humidity",
          wind_speed_entity: "sensor.dev_outdoor_wind",
          uv_index_entity: "sensor.dev_outdoor_uv",
        }),
        card({ entity: "weather.dev_weather_daily_only", name: "No wind or UV (daily only)" }),
      ),
      section(
        heading("Colour thresholds", "mdi:palette"),
        card({ name: "Custom thresholds (10–25 °C)", cold_threshold: 10, hot_threshold: 25 }),
        card({ name: "Default thresholds" }),
      ),
    ]),

    view("Alerts", "alerts", "mdi:alert", [
      section(heading("Controls", "mdi:tune"), alertControls),
      section(
        heading("Providers", "mdi:alert-circle-outline"),
        card({ name: "Alerts · NWS style (5 sources of alerts, scrolls when expanded)", alerts: { entities: ["sensor.dev_alerts_nws"] } }),
        card({
          name: "Alerts · Meteoalarm + Environment Canada, 2 visible",
          alerts: { entities: ["binary_sensor.dev_meteoalarm", "sensor.dev_home_warnings"], max_visible: 2 },
        }),
      ),
      section(
        heading("Custom adapter", "mdi:code-braces"),
        card({
          name: "Alertas · adaptador propio",
          language: "es",
          alerts: {
            entities: [
              {
                entity: "sensor.dev_custom_alert",
                adapter: "custom",
                level_attr: "nivel",
                event_attr: "titulo",
                expires_attr: "fin",
                levels: { leve: 1, fuerte: 3 },
              },
              "sensor.dev_alerts_nws",
            ],
            min_level: 2,
          },
        }),
      ),
    ]),

    view("Languages", "languages", "mdi:translate", [
      section(heading("Controls", "mdi:tune"), ...weatherControls),
      ...[0, 1, 2, 3].map((n) =>
        section(...LANGUAGES.filter((_, i) => i % 4 === n).map((language) => card({ name: `Language · ${language}`, language }))),
      ),
    ]),
  ],
};

const steps = await waitForHa();
const token = steps.some((s) => !s.done) ? await onboard(steps) : await login();

const ws = connect(token);
await ws.ready;
// The bundle is served with a long cache lifetime: change the query string on each setup to bust it.
const url = `${RESOURCE_URL}?v=${Date.now()}`;
const resources = await ws.send({ type: "lovelace/resources" });
const existing = resources.find((r) => r.url.startsWith(RESOURCE_URL));
if (existing) await ws.send({ type: "lovelace/resources/update", resource_id: existing.id, res_type: "module", url });
else await ws.send({ type: "lovelace/resources/create", res_type: "module", url });
await ws.send({ type: "lovelace/config/save", config: dashboard });
ws.close();

console.log(`\nReady: ${base}  (user: ${USER.username} / password: ${USER.password})`);
console.log("Rebuild with `npm run watch`; hard-reload the browser (Ctrl+Shift+R) to pick up the new bundle.");
