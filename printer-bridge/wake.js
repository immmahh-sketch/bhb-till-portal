// Wakes a printer bridge the moment something it cares about changes in Supabase, instead of it asking every few
// seconds. Polling every 4 s from two bridges was ~410,000 API requests a month (about 80% of all the project's
// traffic), which pushed the Supabase Free plan's log allowance over its limit.
//
// A tiny Supabase Realtime client (the Phoenix websocket protocol), with no npm packages: it uses Node's built-in
// WebSocket (Node 22 or later), or the "ws" package if someone has installed it. With neither, or while the
// connection is down, it reports "not connected" and the bridge carries on polling every few seconds as before.
//
//   const wake = require("./wake.js");
//   wake.watch({ name: "kitchen", changes: [{ table: "print_jobs", filter: "destination=eq.kitchen" }], onChange, onStatus });
//
// onChange() is called (at most every 300 ms) whenever a matching row is inserted, updated or deleted.
// onStatus(true | false) says whether live updates are working, so the bridge knows how often to poll.

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

function socketClass() {
  if (typeof globalThis.WebSocket === "function") return globalThis.WebSocket;
  try { return require("ws"); } catch { return null; }
}

function watch({ name, changes, onChange, onStatus = () => {}, log = console.log }) {
  const WS = socketClass();
  if (!WS) { log(`[wake] no WebSocket in this Node (${process.version}): polling instead. Node 22+ or "npm i ws" turns live updates on.`); onStatus(false); return { close() {} }; }
  const url = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`;
  const topic = `realtime:printer-bridge-${name}`;
  let ws = null, ref = 0, heartbeat = null, retry = 0, live = false, closed = false, debounce = null, lastBeatReply = Date.now();
  const setLive = (v) => { if (v !== live) { live = v; onStatus(v); log(`[wake] live updates ${v ? "ON" : "OFF (polling)"}`); } };
  const send = (msg) => { try { ws.send(JSON.stringify(msg)); } catch {} };
  const fire = () => { clearTimeout(debounce); debounce = setTimeout(() => { try { onChange(); } catch (e) { log(`[wake] onChange: ${e.message}`); } }, 300); };

  function connect() {
    if (closed) return;
    ws = new WS(url);
    const on = (ev, fn) => (ws.addEventListener ? ws.addEventListener(ev, fn) : ws.on(ev, fn));
    on("open", () => {
      retry = 0; lastBeatReply = Date.now();
      send({ topic, event: "phx_join", ref: String(++ref), join_ref: "1", payload: { config: { broadcast: { self: false }, presence: { key: "" }, postgres_changes: changes.map((c) => ({ event: "*", schema: "public", table: c.table, ...(c.filter ? { filter: c.filter } : {}) })), private: false } } });
      clearInterval(heartbeat);
      heartbeat = setInterval(() => {
        // no reply to the last two heartbeats: the connection is dead even if the socket hasn't noticed
        if (Date.now() - lastBeatReply > 65000) { log("[wake] no heartbeat reply, reconnecting"); try { ws.close(); } catch {} return; }
        send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(++ref) });
      }, 25000);
    });
    on("message", (ev) => {
      let m; try { m = JSON.parse(typeof ev === "string" ? ev : ev.data !== undefined ? ev.data : ev.toString()); } catch { return; }
      if (m.topic === "phoenix" && m.event === "phx_reply") { lastBeatReply = Date.now(); return; }
      if (m.topic !== topic) return;
      if (m.event === "phx_reply" && m.payload?.status !== "ok") { log(`[wake] join refused: ${JSON.stringify(m.payload).slice(0, 200)}`); setLive(false); }
      if (m.event === "system") {
        const ok = m.payload?.status === "ok";
        if (!ok) log(`[wake] ${m.payload?.message || "realtime error"}`);
        setLive(ok);
        if (ok) fire(); // catch anything that arrived while we were connecting
      }
      if (m.event === "postgres_changes") fire();
      if (m.event === "phx_error" || m.event === "phx_close") setLive(false);
    });
    const down = () => {
      clearInterval(heartbeat); setLive(false);
      if (closed) return;
      const wait = Math.min(60000, 2000 * 2 ** retry++);
      setTimeout(connect, wait);
    };
    on("close", down);
    on("error", () => {}); // "close" follows and reconnects
  }
  connect();
  return { close() { closed = true; clearInterval(heartbeat); try { ws && ws.close(); } catch {} } };
}

module.exports = { watch };
