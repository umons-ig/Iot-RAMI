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
  getDeviceVersions(): Map<string, string>;
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
<title>RAMI · Gestion</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Martian+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
 :root{--bg:#07120d;--panel:#0d1f17;--line:#1c3a2b;--ph:#2bf08a;--phd:#1c9d5b;--text:#b8d8c8;--muted:#6f9484;--bad:#ff6b6b;}
 *{box-sizing:border-box}
 body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,#0e2a1d 0,var(--bg) 55%),repeating-linear-gradient(0deg,transparent 0 3px,rgba(43,240,138,.022) 3px 4px);color:var(--text);font-family:"Martian Mono",ui-monospace,monospace;padding:2rem 1rem}
 main{max-width:860px;margin:0 auto}
 h1{font-family:"Big Shoulders Display",sans-serif;font-weight:800;font-size:2.2rem;letter-spacing:.02em;margin:0;color:var(--ph);text-shadow:0 0 18px rgba(43,240,138,.4)}
 .sub{color:var(--muted);font-size:.8rem;margin:.1rem 0 1.5rem}
 .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:1.2rem 1.4rem;margin-bottom:1rem;box-shadow:0 0 40px rgba(43,240,138,.05)}
 .card h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--phd);margin:0 0 .9rem}
 label{display:block;font-size:.7rem;color:var(--muted);margin:.5rem 0 .15rem}
 input{width:100%;background:#04130c;color:var(--text);border:1px solid var(--line);border-radius:7px;padding:.5rem .6rem;font:inherit;font-size:.85rem}
 button{font-family:inherit;font-weight:600;font-size:.82rem;cursor:pointer;background:#04130c;color:var(--ph);border:1px solid var(--phd);border-radius:7px;padding:.5rem .9rem;margin-top:.7rem;transition:background .15s}
 button:hover{background:rgba(43,240,138,.1)}
 button.primary{background:var(--phd);color:#04130c;border-color:var(--ph)}
 button.warn{color:#ffcf6a;border-color:#9e6a03}
 button.mini{margin:0;padding:.25rem .6rem;font-size:.72rem}
 .row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:end}
 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:.4rem .9rem}
 .grid2 .f{min-width:0}
 code{color:var(--ph)}
 .dot{font-size:.9rem}.dot.ok{color:var(--ph)}.dot.ko{color:var(--bad)}
 .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.7rem;margin-top:.8rem}
 .metric{background:#04130c;border:1px solid var(--line);border-radius:8px;padding:.6rem .7rem}
 .metric .k{font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
 .metric .v{font-size:1.15rem;color:var(--ph);margin-top:.15rem}
 .dev{display:flex;align-items:center;gap:.6rem;padding:.5rem .2rem;border-bottom:1px solid var(--line);font-size:.82rem}
 .dev:last-child{border-bottom:0}
 .dev .topic{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .badge{font-size:.68rem;color:#04130c;background:var(--phd);border-radius:20px;padding:.1rem .55rem}
 .badge.unk{background:#3a4a42;color:var(--muted)}
 .muted{color:var(--muted)}.hint{font-size:.72rem;color:var(--muted);margin-top:.6rem}
 #toast{position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);background:var(--phd);color:#04130c;font-weight:600;
  padding:.6rem 1.1rem;border-radius:8px;font-size:.82rem;opacity:0;transition:opacity .25s;pointer-events:none}
 #toast.show{opacity:1}
 details summary{cursor:pointer;color:var(--phd);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}
</style></head><body>
<main>
 <h1>RAMI · GESTION</h1>
 <div class="sub">Pilotage de la flotte ESP depuis le fog</div>

 <div class="card" id="loginCard">
  <h2>Connexion</h2>
  <label>Mot de passe admin (ou token)</label>
  <input id="tok" type="password" placeholder="mot de passe ou token" onkeydown="if(event.key==='Enter')login()">
  <button class="primary" onclick="login()">Connexion</button>
  <div class="hint" id="loginErr"></div>
 </div>

 <div id="dash" style="display:none">
  <div class="card">
   <h2>État du fog</h2>
   <div><span id="dHealth" class="dot ko">●</span> santé globale &nbsp;&nbsp; <span id="dKafka" class="dot ko">●</span> Kafka</div>
   <div class="metrics">
    <div class="metric"><div class="k">outbox</div><div class="v" id="mOutbox">—</div></div>
    <div class="metric"><div class="k">buffer</div><div class="v" id="mBuffer">—</div></div>
    <div class="metric"><div class="k">droppés</div><div class="v" id="mDrops">—</div></div>
    <div class="metric"><div class="k">capteurs</div><div class="v" id="mDevices">—</div></div>
    <div class="metric"><div class="k">uptime</div><div class="v" id="mUptime">—</div></div>
   </div>
  </div>

  <div class="card">
   <h2>Capteurs (ESP)</h2>
   <div id="devs"><div class="muted">chargement…</div></div>
   <button class="warn" onclick="if(confirm('Redémarrer TOUS les ESP ?'))cmd('all','restart')">⟳ Redémarrer tous</button>
  </div>

  <div class="card">
   <h2>Configurer (tous les ESP)</h2>
   <div class="grid2">
    <div class="f"><label>WiFi SSID</label><input id="ssid"></div>
    <div class="f"><label>WiFi mot de passe</label><input id="wpass" type="password"></div>
   </div>
   <button onclick="setWifi()">Appliquer le WiFi à tous</button>
   <div class="grid2" style="margin-top:1rem">
    <div class="f"><label>MQTT broker</label><input id="mbroker" placeholder="192.168.10.4"></div>
    <div class="f"><label>MQTT user</label><input id="muser"></div>
    <div class="f"><label>MQTT mot de passe</label><input id="mpass" type="password"></div>
   </div>
   <button onclick="setMqtt()">Appliquer le MQTT à tous</button>
  </div>

  <div class="card">
   <details>
    <summary>OTA manuelle (avancé)</summary>
    <label>URL du binaire app (.bin)</label>
    <input id="otaurl" placeholder="https://…/flash/versions/v1.2.8/rami-universal.bin">
    <button class="warn" onclick="if(confirm('Lancer l OTA sur TOUS les ESP ?'))otaAll()">⬆ OTA à tous</button>
    <div class="hint">L'auto-OTA (opt-in) met déjà à jour chaque ESP en retard automatiquement. Ce bouton est pour un déclenchement manuel.</div>
   </details>
  </div>
 </div>
</main>
<div id="toast"></div>
<script>
 var $=function(id){return document.getElementById(id)};
 function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function H(extra){var h=Object.assign({},extra||{});var t=localStorage.getItem('mgmtToken');if(t)h['X-Mgmt-Token']=t;return h}
 var toastT;function toast(m){var e=$('toast');e.textContent=m;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){e.classList.remove('show')},2200)}

 function showDash(on){$('dash').style.display=on?'block':'none';$('loginCard').style.display=on?'none':'block'}

 async function login(){
  var secret=$('tok').value;
  var r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:secret})});
  if(r.ok){var j=await r.json();localStorage.setItem('mgmtToken',j.token);}
  else{var e=await r.json().catch(function(){return{}});
   if((e.error||'').indexOf('non configuré')>=0){localStorage.setItem('mgmtToken',secret);}
   else{$('loginErr').textContent='Mot de passe invalide';return;}}
  $('tok').value='';$('loginErr').textContent='';init();
 }

 async function cmd(target,c,extra){
  var r=await fetch('/api/command',{method:'POST',headers:H({'content-type':'application/json'}),body:JSON.stringify(Object.assign({target:target,cmd:c},extra||{}))});
  if(r.status===401){toast('Session expirée — reconnecte-toi');showDash(false);return false}
  var j=await r.json().catch(function(){return{}});
  toast(j.ok?('✓ '+c+(j.sent!=null?(' ('+j.sent+')'):'')):('✗ '+(j.error||'erreur')));
  refresh();return j.ok;
 }
 function setWifi(){if(!$('ssid').value)return toast('SSID requis');cmd('all','set_wifi',{ssid:$('ssid').value,pass:$('wpass').value})}
 function setMqtt(){cmd('all','set_mqtt',{broker:$('mbroker').value,user:$('muser').value,pass:$('mpass').value})}
 function otaAll(){if(!$('otaurl').value)return toast('URL requise');cmd('all','ota',{url:$('otaurl').value})}

 async function loadStatus(){
  var r=await fetch('/api/status',{headers:H()});
  if(!r.ok){showDash(false);return false}
  var s=await r.json();
  $('dHealth').className='dot '+(s.healthy?'ok':'ko');
  $('dKafka').className='dot '+(s.kafkaConnected?'ok':'ko');
  $('mOutbox').textContent=s.outboxPending;$('mBuffer').textContent=s.bufferSize;
  $('mDrops').textContent=s.drops;$('mDevices').textContent=s.devices;$('mUptime').textContent=s.uptimeSec+'s';
  return true;
 }
 async function loadDevices(){
  var r=await fetch('/api/devices',{headers:H()});if(!r.ok)return;var j=await r.json();
  var d=j.devices||[];
  $('devs').innerHTML=d.length?d.map(function(x){
   var v=(x.version&&x.version!=='?')?('<span class="badge">'+esc(x.version)+'</span>'):'<span class="badge unk">?</span>';
   return '<div class="dev"><span class="topic"><code>'+esc(x.topic)+'</code></span>'+v+
    '<button class="mini restart-dev" data-topic="'+esc(x.topic)+'">restart</button></div>';
  }).join(''):'<div class="muted">aucun capteur vu pour l instant</div>';
 }
 $('devs').addEventListener('click',function(e){
  var b=e.target.closest('.restart-dev');if(b)cmd(b.dataset.topic,'restart');
 });

 function refresh(){loadStatus();loadDevices()}
 async function init(){
  var ok=await loadStatus();   // 200 -> authentifié (ou aucune auth configurée)
  if(ok){showDash(true);loadDevices();}
  else{showDash(false);}
 }
 init();setInterval(function(){if($('dash').style.display!=='none')refresh()},5000);
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
      const versions = fog.getDeviceVersions();
      const devices = fog
        .getKnownDevices()
        .map((topic) => ({ topic, version: versions.get(topic) ?? "?" }));
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
