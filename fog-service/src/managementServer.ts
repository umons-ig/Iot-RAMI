/**
 * Web server de GESTION des ESP, hébergé sur le fog.
 *
 * Expose une petite API (et une UI minimale) pour piloter les capteurs branchés
 * au fog via des commandes MQTT sur leur topic /server :
 *   - lister les ESP connus
 *   - pousser une commande à UN ESP ou à TOUS : ota / set_wifi / set_mqtt /
 *     restart / ping / start / stop
 *
 * Les commandes sont exécutées côté ESP par le SensorRunner (cf. firmware).
 */
import http from "http";
import { timingSafeEqual, createHmac, scryptSync } from "crypto";

// Comparaison de chaînes à temps constant (longueurs différentes -> false).
function constantEquals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Durée de vie d'un jeton de session de la console fog. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

const SESSION_SALT = "rami-fog-session-v2";

// scrypt est volontairement lent : on met la clé dérivée en cache pour ne pas
// le repayer à chaque requête /api/* (le fog tourne sur un Raspberry Pi).
const derivedKeyCache = new Map<string, Buffer>();

function sessionKey(password: string): Buffer {
  const cached = derivedKeyCache.get(password);
  if (cached) return cached;
  // scryptSync : dérivation LENTE, contrairement au sha256 d'origine qui
  // permettait de retrouver le mot de passe admin hors ligne (sel fixe et
  // public) à des millions d'essais par seconde.
  const key = scryptSync(password, SESSION_SALT, 32);
  derivedKeyCache.set(password, key);
  return key;
}

/**
 * Jeton de session dérivé du mot de passe, au format `<expiration>.<hmac>`.
 *
 * Deux propriétés que l'ancien `sha256(sel_fixe + password)` n'avait pas :
 *  - il EXPIRE (l'expiration est signée, donc non falsifiable) ;
 *  - il ne permet pas de casser le mot de passe hors ligne (clé dérivée par
 *    scrypt), alors qu'un sha256 non salé se brute-force en quelques minutes.
 *
 * Reste sans état côté serveur : un redémarrage du fog ne déconnecte pas.
 */
export function sessionTokenFor(
  password: string,
  ttlMs: number = SESSION_TTL_MS,
  now: number = Date.now(),
): string {
  const expiresAt = now + ttlMs;
  const mac = createHmac("sha256", sessionKey(password))
    .update(String(expiresAt))
    .digest("hex");
  return `${expiresAt}.${mac}`;
}

/** Vérifie un jeton de session : signature valide ET non expiré. */
export function verifySessionToken(
  provided: string,
  password: string,
  now: number = Date.now(),
): boolean {
  if (!password || !provided) return false;
  const dot = provided.indexOf(".");
  if (dot <= 0) return false;

  const expiresAtRaw = provided.slice(0, dot);
  const mac = provided.slice(dot + 1);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = createHmac("sha256", sessionKey(password))
    .update(expiresAtRaw)
    .digest("hex");
  return constantEquals(mac, expected);
}

/**
 * Vérifie le token de gestion statique (header X-Mgmt-Token), en temps constant.
 *
 * Fail-closed : si aucun token n'est configuré, on REFUSE. Renvoyer `true` dans
 * ce cas ouvrait l'API de pilotage de la flotte (OTA / WiFi / restart) à tout
 * le monde dès que la variable d'environnement était absente.
 */
export function checkToken(provided: string | undefined, expected: string): boolean {
  if (!expected) return false;
  if (!provided) return false;
  return constantEquals(provided, expected);
}

/**
 * Autorisation d'une requête /api/*. Accepte le token statique (scripts) OU un
 * jeton de session (issu du login par mot de passe).
 *
 * FAIL-CLOSED : sans MGMT_TOKEN ni MGMT_PASSWORD, tout est refusé. La version
 * précédente renvoyait `true` — or le service d'installation laisse ces
 * variables vides et le compose écoute au-delà de la loopback : l'API qui
 * pousse un firmware OTA sur toute la flotte d'ESP était donc accessible sans
 * la moindre authentification.
 */
export function isAuthorized(
  headerToken: string | undefined,
  token: string,
  password: string,
): boolean {
  if (!token && !password) return false; // aucune auth configurée -> on refuse
  if (!headerToken) return false;
  if (token && constantEquals(headerToken, token)) return true; // token statique (scripts)
  if (password && verifySessionToken(headerToken, password)) return true; // session
  return false;
}

/**
 * Anti-bruteforce du login de la console : sans plafond, le mot de passe admin
 * de la flotte (qui commande l'OTA de tous les ESP) était attaquable à débit
 * illimité. Fenêtre glissante simple, en mémoire.
 */
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// Borne le nombre d'IP suivies : sans plafond, un attaquant usurpant des IP
// sources ferait croître la Map indéfiniment (épuisement mémoire du Pi).
const LOGIN_MAX_TRACKED_IPS = 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function registerLoginFailure(ip: string, now: number = Date.now()): void {
  const entry = loginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    if (loginAttempts.size >= LOGIN_MAX_TRACKED_IPS) {
      // Purge des fenêtres expirées ; à défaut, on évince la plus ancienne clé.
      for (const [key, value] of loginAttempts) {
        if (now >= value.resetAt) loginAttempts.delete(key);
      }
      if (loginAttempts.size >= LOGIN_MAX_TRACKED_IPS) {
        const oldest = loginAttempts.keys().next().value;
        if (oldest !== undefined) loginAttempts.delete(oldest);
      }
    }
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function isLoginRateLimited(ip: string, now: number = Date.now()): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (now >= entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/** Vérifie le mot de passe admin (login). */
export function verifyPassword(provided: string, expected: string): boolean {
  if (!expected || !provided) return false;
  return constantEquals(provided, expected);
}

export interface FogMetricsSnapshot {
  outboxPending: number;
  kafkaConnected: boolean;
  drops: number;
  bufferSize: number;
}

export interface DeviceCommandProvider {
  getKnownDevices(): string[];
  getDeviceVersions(): Map<string, string>;
  getHaExposedTopics(): Set<string>;
  setHaExposed(sensorTopic: string, enabled: boolean): Promise<void>;
  publishDeviceCommand(sensorTopic: string, payload: Record<string, unknown>): void;
  broadcastDeviceCommand(payload: Record<string, unknown>): number;
  getMetricsSnapshot(): Promise<FogMetricsSnapshot>;
}

/** Construit l'objet d'état du fog (logique pure, testable). */
export function buildStatus(
  snapshot: FogMetricsSnapshot,
  deviceCount: number,
  uptimeSec: number,
): Record<string, unknown> {
  return {
    ...snapshot,
    devices: deviceCount,
    uptimeSec: Math.round(uptimeSec),
    healthy: snapshot.kafkaConnected && snapshot.outboxPending >= 0,
  };
}

// Commandes autorisées (liste blanche).
const ALLOWED_COMMANDS = new Set([
  "ota",
  "set_wifi",
  "set_mqtt",
  "restart",
  "ping",
  "start",
  "stop",
]);

/**
 * Construit le payload MQTT à partir d'une commande + ses paramètres, en
 * validant les champs requis. Renvoie null si la commande est inconnue ou s'il
 * manque un paramètre obligatoire.
 */
export function buildCommandPayload(
  cmd: string,
  params: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!ALLOWED_COMMANDS.has(cmd)) return null;
  switch (cmd) {
    case "ota": {
      // HTTPS uniquement. Autoriser http:// laissait un attaquant sur le chemin
      // réseau substituer le binaire et faire exécuter un firmware arbitraire
      // sur les capteurs. `ALLOW_INSECURE_OTA=true` réserve http:// à un banc
      // de test (le firmware refuse de son côté sans -DRAMI_ALLOW_INSECURE_OTA).
      const url = params.url ? String(params.url) : "";
      const allowInsecure = process.env.ALLOW_INSECURE_OTA === "true";
      const pattern = allowInsecure ? /^https?:\/\//i : /^https:\/\//i;
      if (!pattern.test(url)) return null;
      return { cmd, url };
    }
    case "set_wifi":
      return params.ssid
        ? { cmd, ssid: String(params.ssid), pass: String(params.pass ?? "") }
        : null;
    case "set_mqtt":
      return params.broker || params.user || params.pass
        ? {
            cmd,
            broker: String(params.broker ?? ""),
            user: String(params.user ?? ""),
            pass: String(params.pass ?? ""),
          }
        : null;
    default:
      // restart / ping / start / stop : aucun paramètre.
      return { cmd };
  }
}

/**
 * Traite une requête de commande (logique pure, testable). `body` = JSON parsé
 * { target: "all" | "<sensorTopic>", cmd, ...params }.
 */
export function handleCommand(
  fog: DeviceCommandProvider,
  body: Record<string, unknown> | null,
): { status: number; body: object } {
  const { target, cmd, ...params } = body ?? {};
  if (!cmd || typeof cmd !== "string") {
    return { status: 400, body: { error: "champ 'cmd' manquant" } };
  }
  const payload = buildCommandPayload(cmd, params as Record<string, unknown>);
  if (!payload) {
    return { status: 400, body: { error: `commande ou paramètres invalides: ${cmd}` } };
  }
  if (!target || target === "all") {
    const sent = fog.broadcastDeviceCommand(payload);
    return { status: 200, body: { ok: true, target: "all", sent } };
  }

  // La cible doit être un appareil CONNU — même garde que /api/ha. Sans elle,
  // `target` partait tel quel vers `publishDeviceCommand`, donc la console
  // devenait un injecteur MQTT arbitraire : publication sur un bus tiers
  // (Zigbee2MQTT…), ou réinjection vers le fog lui-même, qui est abonné à `#`.
  const targetTopic = String(target);
  if (!fog.getKnownDevices().includes(targetTopic)) {
    return { status: 400, body: { error: `capteur inconnu: ${targetTopic}` } };
  }

  fog.publishDeviceCommand(targetTopic, payload);
  return { status: 200, body: { ok: true, target: targetTopic, sent: 1 } };
}

const UI_HTML = `
<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RAMI · Fog Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Martian+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
 :root{--color-background:#070600;--color-surface:#0f0c00;--color-surface-secondary:#181300;--color-primary:#ff9f0a;--color-primary-hover:#e08c00;--color-primary-glow:rgba(255,159,10,.18);--color-text:#f0d89a;--color-text-muted:#7a6535;--color-border:#241c00;--color-border-bright:#3a2e00;--color-success:#39ff14;--color-danger:#ff4040;--color-warning:#ffcc00}
:root[data-theme=green]{--color-background:#000a02;--color-surface:#021004;--color-surface-secondary:#04190a;--color-primary:#39ff6e;--color-primary-hover:#28e85a;--color-primary-glow:rgba(57,255,110,.2);--color-text:#b6ffce;--color-text-muted:#2f8f46;--color-border:#093a17;--color-border-bright:#0e5a24;--color-success:#39ff14;--color-danger:#ff5a5a;--color-warning:#d8ff00}
:root[data-theme=light]{color-scheme:light;--color-background:#f2ead8;--color-surface:#ede3cc;--color-surface-secondary:#e5d9bc;--color-primary:#b86e00;--color-primary-hover:#9a5c00;--color-primary-glow:rgba(184,110,0,.22);--color-text:#1a1200;--color-text-muted:#7a6030;--color-border:#c8b896;--color-border-bright:#b0996e;--color-success:#1a8a00;--color-danger:#cc2200;--color-warning:#b88000}
:root{--bg:var(--color-background);--bg2:var(--color-surface);--panel:color-mix(in srgb,var(--color-surface) 90%,transparent);--line:var(--color-border);--line2:var(--color-border-bright);--ph:var(--color-primary);--phd:var(--color-primary-hover);--text:var(--color-text);--muted:var(--color-text-muted);--ok:var(--color-success);--bad:var(--color-danger);--warn:var(--color-warning);--field:color-mix(in srgb,var(--color-surface) 60%,#000)}
.themesel{background:var(--field);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:.3rem .5rem;font-family:inherit;font-size:.72rem;cursor:pointer}
 *{box-sizing:border-box}
 [hidden]{display:none!important} /* sinon .login{display:flex}/.dash écrasent l'attribut hidden */
 html,body{margin:0;height:100%}
 body{
  background:
   radial-gradient(1200px 600px at 80% -10%,color-mix(in srgb,var(--color-primary) 10%,transparent),transparent 60%),
   radial-gradient(900px 500px at 10% 110%,color-mix(in srgb,var(--color-primary-hover) 8%,transparent),transparent 60%),
   var(--bg);
  color:var(--text);font-family:"Martian Mono",ui-monospace,monospace;font-size:14px;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
 }
 /* scanlines + grille d'ambiance */
 .scan{position:fixed;inset:0;pointer-events:none;z-index:50;
  background:repeating-linear-gradient(0deg,transparent 0 2px,color-mix(in srgb,var(--color-primary) 3%,transparent) 2px 3px);
  mix-blend-mode:screen;animation:drift 16s linear infinite;opacity:.6}
 @keyframes drift{to{background-position:0 60px}}
 a{color:var(--phd)} code{color:var(--ph);font-size:.92em}
 button{font-family:inherit;font-weight:600;cursor:pointer;border-radius:9px;font-size:.82rem;
  background:var(--field);color:var(--ph);border:1px solid var(--line2);padding:.55rem 1rem;transition:.15s}
 button:hover{background:color-mix(in srgb,var(--color-primary) 12%,transparent);border-color:var(--ph)}
 button.primary{background:var(--ph);color:#04130c;border-color:var(--ph);box-shadow:0 0 22px color-mix(in srgb,var(--color-primary) 30%,transparent)}
 button.primary:hover{filter:brightness(1.08)}
 button.warn{color:var(--warn);border-color:#7a5a16}
 button.ghost{background:transparent;border-color:var(--line);color:var(--muted);padding:.4rem .8rem}
 input{width:100%;background:var(--field);color:var(--text);border:1px solid var(--line);border-radius:9px;
  padding:.6rem .7rem;font:inherit;font-size:.85rem;outline:none;transition:.15s}
 input:focus{border-color:var(--ph);box-shadow:0 0 0 3px color-mix(in srgb,var(--color-primary) 12%,transparent)}

 /* ── Top bar ── */
 .bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;
  padding:.8rem 1.4rem;background:rgba(5,13,9,.78);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
 .brand{display:flex;align-items:baseline;gap:.6rem}
 .logo{font-family:"Big Shoulders Display",sans-serif;font-weight:800;font-size:1.5rem;color:var(--ph);
  letter-spacing:.04em;text-shadow:0 0 16px color-mix(in srgb,var(--color-primary) 50%,transparent)}
 .tag{font-size:.62rem;letter-spacing:.25em;color:var(--muted)}
 .barright{display:flex;align-items:center;gap:.8rem}
 .pill{display:inline-flex;align-items:center;gap:.5rem;font-size:.74rem;color:var(--muted);
  border:1px solid var(--line);border-radius:30px;padding:.3rem .8rem}
 .pill .d{width:8px;height:8px;border-radius:50%;background:var(--bad);box-shadow:0 0 0 0 rgba(255,111,111,.5)}
 .pill.live .d{background:var(--ok);animation:pulse 2s infinite}
 @keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,currentColor 55%,transparent)}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}

 /* ── Login ── */
 .login{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;padding:2rem;position:relative}
 .scope{position:absolute;width:420px;height:420px;border-radius:50%;border:1px solid color-mix(in srgb,var(--color-primary) 14%,transparent);
  box-shadow:0 0 80px color-mix(in srgb,var(--color-primary) 12%,transparent) inset;animation:breathe 5s ease-in-out infinite}
 .scope::after{content:"";position:absolute;inset:60px;border-radius:50%;border:1px solid color-mix(in srgb,var(--color-primary) 10%,transparent)}
 @keyframes breathe{50%{transform:scale(1.06);opacity:.7}}
 .login h1{font-family:"Big Shoulders Display",sans-serif;font-weight:800;font-size:4rem;margin:0;color:var(--ph);
  letter-spacing:.05em;text-shadow:0 0 30px color-mix(in srgb,var(--color-primary) 45%,transparent);z-index:1}
 .loginsub{font-size:.72rem;letter-spacing:.22em;color:var(--muted);text-transform:uppercase;margin-bottom:1.4rem;z-index:1}
 .loginbox{display:flex;gap:.6rem;width:min(380px,90vw);z-index:1}
 .loginbox input{flex:1}
 .err{color:var(--bad);font-size:.78rem;height:1rem;z-index:1}

 /* ── Dashboard ── */
 .dash{max-width:1100px;margin:0 auto;padding:1.6rem 1.4rem 4rem}
 h2{font-family:"Big Shoulders Display",sans-serif;font-weight:700;font-size:1.15rem;letter-spacing:.06em;
  text-transform:uppercase;color:var(--text);margin:0 0 .9rem}
 .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.8rem;margin-bottom:1.6rem}
 .tile{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--phd);border-radius:12px;
  padding:.9rem 1rem;opacity:0;transform:translateY(10px);animation:rise .5s forwards}
 .tile.bad{border-left-color:var(--bad)}
 .tile .k{font-size:.64rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
 .tile .v{font-size:1.55rem;margin-top:.25rem;color:var(--ph);display:flex;align-items:center;gap:.5rem}
 .tile.bad .v{color:var(--bad)}
 .tile .v .d{width:10px;height:10px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
 @keyframes rise{to{opacity:1;transform:none}}

 .cols{display:grid;grid-template-columns:1.6fr 1fr;gap:1.2rem;align-items:start}
 @media(max-width:820px){.cols{grid-template-columns:1fr}}
 .panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:1.3rem 1.4rem}

 .fleet{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.8rem}
 .node{background:var(--field);border:1px solid var(--line);border-radius:12px;padding:.9rem;transition:.15s;
  opacity:0;transform:translateY(8px);animation:rise .45s forwards}
 .node:hover{border-color:var(--line2);transform:translateY(-2px)}
 .node .top{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
 .node .online{width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok);flex:none}
 .node .name{font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
 .node .topic{font-size:.66rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:.6rem}
 .node .foot{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
 .node .ha{display:flex;align-items:center;gap:.45rem;margin-top:.6rem;padding-top:.55rem;border-top:1px solid var(--line);font-size:.68rem;color:var(--muted);cursor:pointer;user-select:none}
 .node .ha input{accent-color:var(--ph);width:14px;height:14px;cursor:pointer;flex:none}
 .ver{font-size:.66rem;color:#0a0700;background:var(--phd);border-radius:20px;padding:.12rem .55rem;font-weight:600}
 .ver.unk{background:var(--line2);color:var(--muted)}
 .node button{padding:.3rem .6rem;font-size:.7rem}
 .empty{color:var(--muted);font-size:.85rem;padding:1rem 0;text-align:center}

 .actions .act{padding:.4rem 0 1rem;border-bottom:1px solid var(--line)}
 .actions .act:last-child{border-bottom:0;padding-bottom:0}
 .actions h3{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--phd);margin:.2rem 0 .55rem}
 .actions input{margin-bottom:.45rem}
 details summary{cursor:pointer;color:var(--muted);font-size:.74rem;margin-top:.4rem}
 details[open] summary{color:var(--phd);margin-bottom:.5rem}

 #toast{position:fixed;left:50%;bottom:1.4rem;transform:translateX(-50%) translateY(20px);z-index:60;
  background:var(--ph);color:#04130c;font-weight:600;padding:.65rem 1.2rem;border-radius:10px;font-size:.82rem;
  box-shadow:0 8px 30px rgba(0,0,0,.4);opacity:0;transition:.3s;pointer-events:none}
 #toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
 #toast.err{background:var(--bad)}
</style></head><body>
<div class="scan"></div>

<header class="bar" id="bar" hidden>
 <div class="brand"><span class="logo">RAMI</span><span class="tag">FOG&nbsp;CONTROL</span></div>
 <div class="barright">
  <span class="pill" id="connPill"><i class="d"></i><span id="connTxt">hors ligne</span></span>
  <select id="theme" class="themesel"><option value="amber">Ambre</option><option value="green">Vert</option><option value="light">Clair</option></select>
  <button class="ghost" id="logout">Déconnexion</button>
 </div>
</header>

<section class="login" id="login">
 <div class="scope"></div>
 <h1>RAMI</h1>
 <div class="loginsub">Fog Control · accès restreint</div>
 <div class="loginbox">
  <input id="pwd" type="password" placeholder="mot de passe admin" autocomplete="current-password">
  <button class="primary" id="loginBtn">Entrer</button>
 </div>
 <div class="err" id="loginErr"></div>
</section>

<main class="dash" id="dash" hidden>
 <section class="stats" id="stats"></section>
 <div class="cols">
  <section class="panel">
   <h2>Flotte de capteurs</h2>
   <div class="fleet" id="fleet"><div class="empty">chargement…</div></div>
  </section>
  <aside class="panel actions">
   <h2>Actions · toute la flotte</h2>
   <div class="act">
    <h3>WiFi</h3>
    <input id="ssid" placeholder="SSID">
    <input id="wpass" type="password" placeholder="mot de passe WiFi">
    <button data-act="wifi">Appliquer à tous</button>
   </div>
   <div class="act">
    <h3>MQTT</h3>
    <input id="mbroker" placeholder="broker (IP)">
    <input id="muser" placeholder="utilisateur">
    <input id="mpass" type="password" placeholder="mot de passe">
    <button data-act="mqtt">Appliquer à tous</button>
   </div>
   <div class="act">
    <h3>Maintenance</h3>
    <button class="warn" data-act="restart">⟳ Redémarrer tous</button>
    <details>
     <summary>OTA manuelle (avancé)</summary>
     <input id="otaurl" placeholder="https://…/rami-universal.bin">
     <button class="warn" data-act="ota">⬆ OTA à tous</button>
    </details>
   </div>
  </aside>
 </div>
</main>

<div id="toast"></div>
<script>
 var $=function(s){return document.querySelector(s)};
 function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function H(x){var h=Object.assign({},x||{});var t=localStorage.getItem('mgmtToken');if(t)h['X-Mgmt-Token']=t;return h}
 var tT;function toast(m,bad){var e=$('#toast');e.textContent=m;e.className=bad?'show err':'show';clearTimeout(tT);tT=setTimeout(function(){e.className=''},2400)}
 function fmtUp(s){s=+s||0;var h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?(h+'h'+(m<10?'0':'')+m):(m?m+'m':s+'s')}
 function nodeName(t){var n=String(t);if(n.slice(-13)==='-topic/sensor')return n.slice(0,-13);if(n.slice(-7)==='/sensor')return n.slice(0,-7);return n}

 function view(authed){
  $('#login').hidden=authed;$('#dash').hidden=!authed;$('#bar').hidden=!authed;
 }
 function logout(){localStorage.removeItem('mgmtToken');view(false);$('#pwd').value=''}

 async function login(){
  var secret=$('#pwd').value;
  var r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:secret})});
  if(r.ok){var j=await r.json();localStorage.setItem('mgmtToken',j.token);}
  else{var e=await r.json().catch(function(){return{}});
   if((e.error||'').indexOf('non configuré')>=0){localStorage.setItem('mgmtToken',secret);}
   else{$('#loginErr').textContent='Mot de passe invalide';return;}}
  $('#pwd').value='';$('#loginErr').textContent='';init();
 }

 async function cmd(target,c,extra){
  var r=await fetch('/api/command',{method:'POST',headers:H({'content-type':'application/json'}),body:JSON.stringify(Object.assign({target:target,cmd:c},extra||{}))});
  if(r.status===401){toast('Session expirée',1);logout();return}
  var j=await r.json().catch(function(){return{}});
  if(j.ok)toast('✓ '+c+(j.sent!=null?(' → '+j.sent):''));else toast('✗ '+(j.error||'erreur'),1);
  setTimeout(refresh,400);
 }

 function tile(k,v,opts){opts=opts||{};
  var dot=opts.dot?('<span class="d"></span>'):'';
  return '<div class="tile'+(opts.bad?' bad':'')+'" style="animation-delay:'+(opts.i*0.05)+'s"><div class="k">'+k+'</div><div class="v">'+dot+esc(String(v))+'</div></div>';
 }
 async function loadStatus(){
  var r=await fetch('/api/status',{headers:H()});
  if(!r.ok){logout();return false}
  var s=await r.json();
  $('#connPill').className='pill live';$('#connTxt').textContent='en ligne · '+fmtUp(s.uptimeSec);
  $('#stats').innerHTML=
   tile('Santé',s.healthy?'OK':'KO',{dot:1,bad:!s.healthy,i:0})+
   tile('Kafka',s.kafkaConnected?'OK':'KO',{dot:1,bad:!s.kafkaConnected,i:1})+
   tile('Capteurs',s.devices,{i:2})+
   tile('Outbox',s.outboxPending,{bad:s.outboxPending<0,i:3})+
   tile('Buffer',s.bufferSize,{i:4})+
   tile('Droppés',s.drops,{bad:s.drops>0,i:5});
  return true;
 }
 async function loadDevices(){
  var r=await fetch('/api/devices',{headers:H()});if(!r.ok)return;var j=await r.json();var d=j.devices||[];
  if(!d.length){$('#fleet').innerHTML='<div class="empty">Aucun capteur vu pour le moment.<br>Allume un ESP configuré pour ce fog.</div>';return}
  $('#fleet').innerHTML=d.map(function(x,i){
   var v=(x.version&&x.version!=='?')?('<span class="ver">'+esc(x.version)+'</span>'):'<span class="ver unk">version ?</span>';
   return '<div class="node" style="animation-delay:'+(i*0.04)+'s">'+
    '<div class="top"><span class="online"></span><span class="name">'+esc(nodeName(x.topic))+'</span></div>'+
    '<div class="topic">'+esc(x.topic)+'</div>'+
    '<div class="foot">'+v+'<button class="restart-dev" data-topic="'+esc(x.topic)+'">⟳ restart</button></div>'+
    '<label class="ha"><input type="checkbox" class="ha-dev" data-topic="'+esc(x.topic)+'"'+(x.haExposed?' checked':'')+'><span>Exposer à Home Assistant</span></label>'+
    '</div>';
  }).join('');
 }
 async function haToggle(topic,enabled,el){
  var r=await fetch('/api/ha',{method:'POST',headers:H({'content-type':'application/json'}),body:JSON.stringify({topic:topic,enabled:enabled})});
  if(r.status===401){toast('Session expirée',1);logout();return}
  var j=await r.json().catch(function(){return{}});
  if(j.ok)toast(enabled?'✓ exposé à Home Assistant':'✓ retiré de Home Assistant');
  else{toast('✗ '+(j.error||'erreur'),1);if(el)el.checked=!enabled}
 }
 function refresh(){loadStatus();loadDevices()}
 async function init(){var ok=await loadStatus();view(ok);if(ok)loadDevices()}

 // events
 $('#loginBtn').addEventListener('click',login);
 $('#pwd').addEventListener('keydown',function(e){if(e.key==='Enter')login()});
 $('#logout').addEventListener('click',logout);
 $('#fleet').addEventListener('click',function(e){var b=e.target.closest('.restart-dev');if(b)cmd(b.dataset.topic,'restart')});
 $('#fleet').addEventListener('change',function(e){var c=e.target.closest('.ha-dev');if(c)haToggle(c.dataset.topic,c.checked,c)});
 document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;var a=b.dataset.act;
  if(a==='wifi'){if(!$('#ssid').value)return toast('SSID requis',1);cmd('all','set_wifi',{ssid:$('#ssid').value,pass:$('#wpass').value})}
  else if(a==='mqtt')cmd('all','set_mqtt',{broker:$('#mbroker').value,user:$('#muser').value,pass:$('#mpass').value});
  else if(a==='restart'){if(confirm('Redémarrer TOUS les ESP ?'))cmd('all','restart')}
  else if(a==='ota'){if(!$('#otaurl').value)return toast('URL requise',1);if(confirm('OTA sur TOUS les ESP ?'))cmd('all','ota',{url:$('#otaurl').value})}
 });
 (function(){var k='ramiTheme';var th=localStorage.getItem(k)||'amber';document.documentElement.dataset.theme=th;var ts=$('#theme');if(ts){ts.value=th;ts.onchange=function(){localStorage.setItem(k,ts.value);document.documentElement.dataset.theme=ts.value}}})();
 init();setInterval(function(){if(!$('#dash').hidden)refresh()},5000);
</script></body></html>
`;

export function createManagementServer(
  fog: DeviceCommandProvider,
  port: number,
  token = "",
  host = "127.0.0.1",
  password = "",
): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    const headerToken = req.headers["x-mgmt-token"] as string | undefined;

    // Login par mot de passe admin -> renvoie un jeton DÉRIVÉ (sans état, stable
    // à travers les redémarrages du fog). Pas d'auth requise sur cette route.
    if (req.method === "POST" && url === "/api/login") {
      const clientIp = req.socket.remoteAddress ?? "unknown";
      if (isLoginRateLimited(clientIp)) {
        res.writeHead(429, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "trop de tentatives, réessayez plus tard" }));
        return;
      }
      let raw = "";
      req.on("data", (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
      req.on("end", () => {
        let pwd = "";
        try { pwd = String((JSON.parse(raw || "{}") as { password?: unknown }).password ?? ""); } catch { /* ignore */ }
        if (password && verifyPassword(pwd, password)) {
          clearLoginAttempts(clientIp);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ token: sessionTokenFor(password) }));
        } else {
          // On ne compte un échec QUE si un mot de passe est configuré. Sinon
          // (fog piloté par MGMT_TOKEN seul), chaque ouverture de la console
          // passe forcément par cette branche : compter ces appels verrouillait
          // l'admin légitime au bout de 10 connexions.
          if (password) registerLoginFailure(clientIp);
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: password ? "mot de passe invalide" : "login par mot de passe non configuré" }));
        }
      });
      return;
    }

    // Auth sur toutes les routes /api/* (token statique OU session dérivée).
    if (url.startsWith("/api/") && !isAuthorized(headerToken, token, password)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "non autorisé" }));
      return;
    }
    if (req.method === "GET" && url === "/api/devices") {
      const versions = fog.getDeviceVersions();
      const exposed = fog.getHaExposedTopics();
      const devices = fog
        .getKnownDevices()
        .map((topic) => ({
          topic,
          version: versions.get(topic) ?? "?",
          haExposed: exposed.has(topic),
        }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ devices }));
      return;
    }
    if (req.method === "GET" && url === "/api/status") {
      fog
        .getMetricsSnapshot()
        .then((snap) => {
          const status = buildStatus(
            snap,
            fog.getKnownDevices().length,
            process.uptime(),
          );
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(status));
        })
        .catch((e) => {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: String(e) }));
        });
      return;
    }
    if (req.method === "POST" && url === "/api/command") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 1e6) req.destroy(); // garde-fou
      });
      req.on("end", () => {
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "JSON invalide" }));
          return;
        }
        const { status, body } = handleCommand(fog, parsed);
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      });
      return;
    }
    // Exposition d'un capteur à Home Assistant (toggle par capteur).
    if (req.method === "POST" && url === "/api/ha") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 4096) req.destroy();
      });
      req.on("end", () => {
        let topic = "";
        let enabled = false;
        try {
          const b = JSON.parse(raw || "{}") as { topic?: unknown; enabled?: unknown };
          topic = String(b.topic ?? "");
          enabled = Boolean(b.enabled);
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "JSON invalide" }));
          return;
        }
        if (!topic) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "topic requis" }));
          return;
        }
        // N'exposer que des ESP RAMI connus : getKnownDevices() exclut les
        // appareils Zigbee (gérés par Z2M → pas de doublon HA) et tout topic
        // arbitraire passé en direct par l'API.
        if (!fog.getKnownDevices().includes(topic)) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "capteur inconnu" }));
          return;
        }
        fog
          .setHaExposed(topic, enabled)
          .then(() => {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: true, topic, enabled }));
          })
          .catch((e) => {
            res.writeHead(500, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: String(e) }));
          });
      });
      return;
    }
    if (req.method === "GET" && url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(UI_HTML);
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(port, host, () => {
    console.log(`🛠️  [management] web server de gestion sur ${host}:${port}`);
    if (!token && !password) {
      console.error(
        "⛔ [management] Ni MGMT_TOKEN ni MGMT_PASSWORD n'est défini : l'API /api/* " +
          "REFUSE toutes les requêtes (fail-closed). Définissez l'un des deux pour " +
          "piloter la flotte (OTA / WiFi / restart).",
      );
    }
  });
  return server;
}
