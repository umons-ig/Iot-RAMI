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
import { timingSafeEqual, randomBytes } from "crypto";

// Comparaison de chaînes à temps constant (longueurs différentes -> false).
function constantEquals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Vérifie le token de gestion (header X-Mgmt-Token), en temps constant.
 * Si aucun token n'est configuré -> pas d'auth. Logique pure, testable.
 */
export function checkToken(provided: string | undefined, expected: string): boolean {
  if (!expected) return true;
  if (!provided) return false;
  return constantEquals(provided, expected);
}

/**
 * Autorisation d'une requête /api/*. Auth requise dès qu'un token OU un mot de
 * passe admin est configuré. Accepte : le token statique (scripts) OU un jeton
 * de session (issu du login par mot de passe).
 */
export function isAuthorized(
  headerToken: string | undefined,
  token: string,
  password: string,
  sessions: Set<string>,
): boolean {
  if (!token && !password) return true; // aucune auth configurée
  if (!headerToken) return false;
  if (token && constantEquals(headerToken, token)) return true;
  return sessions.has(headerToken);
}

/** Vérifie le mot de passe admin (login). */
export function verifyPassword(provided: string, expected: string): boolean {
  if (!expected || !provided) return false;
  return constantEquals(provided, expected);
}

/** Génère un jeton de session opaque. */
export function newSessionToken(): string {
  return randomBytes(24).toString("hex");
}

export interface FogMetricsSnapshot {
  outboxPending: number;
  kafkaConnected: boolean;
  drops: number;
  bufferSize: number;
}

export interface DeviceCommandProvider {
  getKnownDevices(): string[];
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
      // Valide le schéma : seules des URLs http(s) (pas de file://, data:, etc.).
      const url = params.url ? String(params.url) : "";
      if (!/^https?:\/\//i.test(url)) return null;
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
  fog.publishDeviceCommand(String(target), payload);
  return { status: 200, body: { ok: true, target: String(target), sent: 1 } };
}

const UI_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RAMI · Gestion des capteurs</title>
<style>
 body{font-family:ui-monospace,Menlo,monospace;background:#0d1117;color:#c9d1d9;margin:0;padding:1.5rem;}
 h1{font-size:1.1rem;color:#58a6ff;} .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem;margin:.75rem 0;}
 button{background:#238636;color:#fff;border:0;border-radius:6px;padding:.4rem .8rem;cursor:pointer;font:inherit;}
 button.warn{background:#9e6a03;} input{background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:.35rem;font:inherit;}
 li{margin:.25rem 0;} code{color:#7ee787;}
</style></head><body>
<h1>RAMI · Gestion des capteurs ESP</h1>
<div class="card"><strong>Connexion (mot de passe admin)</strong><br>
 <input id="tok" type="password" size="30" placeholder="mot de passe ou token"> <button onclick="login()">Connexion</button></div>
<div class="card"><strong>État du fog</strong>
 <div id="status" style="margin-top:.5rem;line-height:1.8">chargement…</div></div>
<div class="card"><strong>Capteurs connus</strong><ul id="devs"><li>chargement…</li></ul>
<button onclick="cmd('all','restart')">Restart TOUS</button></div>
<div class="card"><strong>Changer le WiFi (tous)</strong><br>
 SSID <input id="ssid"> Pass <input id="pass" type="password">
 <button class="warn" onclick="setWifi()">Appliquer à tous</button></div>
<div class="card"><strong>OTA (tous)</strong><br>
 URL <input id="otaurl" size="40" placeholder="http://fog/fw/universal.bin">
 <button class="warn" onclick="ota()">Mettre à jour</button></div>
<script>
 // Header d'auth (X-Mgmt-Token) sur chaque requête si un token est enregistré.
 function H(extra){const h=Object.assign({},extra||{});const t=localStorage.getItem('mgmtToken');if(t)h['X-Mgmt-Token']=t;return h;}
 // Login : tente le mot de passe -> jeton de session ; sinon (pas de mot de passe
 // configuré) on utilise le secret saisi comme token statique.
 async function login(){
  const secret=document.getElementById('tok').value;
  const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:secret})});
  if(r.ok){const j=await r.json();localStorage.setItem('mgmtToken',j.token);}
  else{const j=await r.json().catch(()=>({}));
   if((j.error||'').includes('non configuré')){localStorage.setItem('mgmtToken',secret);}
   else{alert('Mot de passe invalide');return;}}
  document.getElementById('tok').value='';load();status();}
 async function load(){const r=await fetch('/api/devices',{headers:H()});const j=await r.json();
  document.getElementById('devs').innerHTML=(j.devices||[]).map(d=>'<li><code>'+d+'</code> '+
   '<button onclick="cmd(\\''+d+'\\',\\'restart\\')">restart</button></li>').join('')||'<li>aucun</li>';}
 async function cmd(target,c,extra){await fetch('/api/command',{method:'POST',headers:H({'content-type':'application/json'}),
  body:JSON.stringify(Object.assign({target,cmd:c},extra||{}))});}
 function setWifi(){cmd('all','set_wifi',{ssid:ssid.value,pass:pass.value});}
 function ota(){cmd('all','ota',{url:otaurl.value});}
 function dot(ok){return '<span style="color:'+(ok?'#2bf08a':'#ff6b6b')+'">●</span>';}
 async function status(){const r=await fetch('/api/status',{headers:H()});const s=await r.json();
  document.getElementById('status').innerHTML=
   dot(s.healthy)+' santé globale &nbsp; '+dot(s.kafkaConnected)+' Kafka<br>'+
   'outbox en attente : <code>'+s.outboxPending+'</code> &nbsp; buffer : <code>'+s.bufferSize+'</code><br>'+
   'messages droppés : <code>'+s.drops+'</code> &nbsp; capteurs : <code>'+s.devices+'</code><br>'+
   'uptime : <code>'+s.uptimeSec+'s</code>';}
 load();status();setInterval(load,5000);setInterval(status,5000);
</script></body></html>`;

export function createManagementServer(
  fog: DeviceCommandProvider,
  port: number,
  token = "",
  host = "127.0.0.1",
  password = "",
): http.Server {
  // Jetons de session émis après login par mot de passe (en mémoire, perdus au
  // redémarrage du service -> re-login).
  const sessions = new Set<string>();

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    const headerToken = req.headers["x-mgmt-token"] as string | undefined;

    // Login par mot de passe admin -> renvoie un jeton de session (pas d'auth requise).
    if (req.method === "POST" && url === "/api/login") {
      let raw = "";
      req.on("data", (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
      req.on("end", () => {
        let pwd = "";
        try { pwd = String((JSON.parse(raw || "{}") as { password?: unknown }).password ?? ""); } catch { /* ignore */ }
        if (password && verifyPassword(pwd, password)) {
          const t = newSessionToken();
          sessions.add(t);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ token: t }));
        } else {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: password ? "mot de passe invalide" : "login par mot de passe non configuré" }));
        }
      });
      return;
    }

    // Auth sur toutes les routes /api/* (token statique OU session de login).
    if (url.startsWith("/api/") && !isAuthorized(headerToken, token, password, sessions)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "non autorisé" }));
      return;
    }
    if (req.method === "GET" && url === "/api/devices") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ devices: fog.getKnownDevices() }));
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
    if (!token && !password && host !== "127.0.0.1" && host !== "localhost") {
      console.warn(
        "⚠️  [management] EXPOSÉ sans MGMT_TOKEN ni MGMT_PASSWORD — l'API pilote OTA/WiFi/restart de la flotte.",
      );
    }
  });
  return server;
}
