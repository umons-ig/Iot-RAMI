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

export interface DeviceCommandProvider {
  getKnownDevices(): string[];
  publishDeviceCommand(sensorTopic: string, payload: Record<string, unknown>): void;
  broadcastDeviceCommand(payload: Record<string, unknown>): number;
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
    case "ota":
      return params.url ? { cmd, url: String(params.url) } : null;
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
<div class="card"><strong>Capteurs connus</strong><ul id="devs"><li>chargement…</li></ul>
<button onclick="cmd('all','restart')">Restart TOUS</button></div>
<div class="card"><strong>Changer le WiFi (tous)</strong><br>
 SSID <input id="ssid"> Pass <input id="pass" type="password">
 <button class="warn" onclick="setWifi()">Appliquer à tous</button></div>
<div class="card"><strong>OTA (tous)</strong><br>
 URL <input id="otaurl" size="40" placeholder="http://fog/fw/universal.bin">
 <button class="warn" onclick="ota()">Mettre à jour</button></div>
<script>
 async function load(){const r=await fetch('/api/devices');const j=await r.json();
  document.getElementById('devs').innerHTML=(j.devices||[]).map(d=>'<li><code>'+d+'</code> '+
   '<button onclick="cmd(\\''+d+'\\',\\'restart\\')">restart</button></li>').join('')||'<li>aucun</li>';}
 async function cmd(target,c,extra){await fetch('/api/command',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(Object.assign({target,cmd:c},extra||{}))});}
 function setWifi(){cmd('all','set_wifi',{ssid:ssid.value,pass:pass.value});}
 function ota(){cmd('all','ota',{url:otaurl.value});}
 load();setInterval(load,5000);
</script></body></html>`;

export function createManagementServer(
  fog: DeviceCommandProvider,
  port: number,
): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (req.method === "GET" && url === "/api/devices") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ devices: fog.getKnownDevices() }));
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
  server.listen(port, () => {
    console.log(`🛠️  [management] web server de gestion sur :${port}`);
  });
  return server;
}
