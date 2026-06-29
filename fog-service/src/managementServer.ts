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

const UI_HTML = `
<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RAMI · Fog Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Martian+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
 :root{
  --bg:#050d09;--bg2:#0a1812;--panel:rgba(13,31,23,.72);--line:#1b3a2b;--line2:#27543d;
  --ph:#34f5a0;--phd:#19b873;--text:#bfe0d0;--muted:#6b9082;--bad:#ff6f6f;--warn:#ffc15e;
 }
 *{box-sizing:border-box}
 html,body{margin:0;height:100%}
 body{
  background:
   radial-gradient(1200px 600px at 80% -10%,rgba(52,245,160,.10),transparent 60%),
   radial-gradient(900px 500px at 10% 110%,rgba(25,184,115,.08),transparent 60%),
   var(--bg);
  color:var(--text);font-family:"Martian Mono",ui-monospace,monospace;font-size:14px;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
 }
 /* scanlines + grille d'ambiance */
 .scan{position:fixed;inset:0;pointer-events:none;z-index:50;
  background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(52,245,160,.03) 2px 3px);
  mix-blend-mode:screen;animation:drift 16s linear infinite;opacity:.6}
 @keyframes drift{to{background-position:0 60px}}
 a{color:var(--phd)} code{color:var(--ph);font-size:.92em}
 button{font-family:inherit;font-weight:600;cursor:pointer;border-radius:9px;font-size:.82rem;
  background:#06160e;color:var(--ph);border:1px solid var(--line2);padding:.55rem 1rem;transition:.15s}
 button:hover{background:rgba(52,245,160,.12);border-color:var(--ph)}
 button.primary{background:var(--ph);color:#04130c;border-color:var(--ph);box-shadow:0 0 22px rgba(52,245,160,.3)}
 button.primary:hover{filter:brightness(1.08)}
 button.warn{color:var(--warn);border-color:#7a5a16}
 button.ghost{background:transparent;border-color:var(--line);color:var(--muted);padding:.4rem .8rem}
 input{width:100%;background:#04120c;color:var(--text);border:1px solid var(--line);border-radius:9px;
  padding:.6rem .7rem;font:inherit;font-size:.85rem;outline:none;transition:.15s}
 input:focus{border-color:var(--ph);box-shadow:0 0 0 3px rgba(52,245,160,.12)}

 /* ── Top bar ── */
 .bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;
  padding:.8rem 1.4rem;background:rgba(5,13,9,.78);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
 .brand{display:flex;align-items:baseline;gap:.6rem}
 .logo{font-family:"Big Shoulders Display",sans-serif;font-weight:800;font-size:1.5rem;color:var(--ph);
  letter-spacing:.04em;text-shadow:0 0 16px rgba(52,245,160,.5)}
 .tag{font-size:.62rem;letter-spacing:.25em;color:var(--muted)}
 .barright{display:flex;align-items:center;gap:.8rem}
 .pill{display:inline-flex;align-items:center;gap:.5rem;font-size:.74rem;color:var(--muted);
  border:1px solid var(--line);border-radius:30px;padding:.3rem .8rem}
 .pill .d{width:8px;height:8px;border-radius:50%;background:var(--bad);box-shadow:0 0 0 0 rgba(255,111,111,.5)}
 .pill.live .d{background:var(--ph);animation:pulse 2s infinite}
 @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,245,160,.5)}70%{box-shadow:0 0 0 7px rgba(52,245,160,0)}100%{box-shadow:0 0 0 0 rgba(52,245,160,0)}}

 /* ── Login ── */
 .login{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;padding:2rem;position:relative}
 .scope{position:absolute;width:420px;height:420px;border-radius:50%;border:1px solid rgba(52,245,160,.14);
  box-shadow:0 0 80px rgba(52,245,160,.12) inset;animation:breathe 5s ease-in-out infinite}
 .scope::after{content:"";position:absolute;inset:60px;border-radius:50%;border:1px solid rgba(52,245,160,.1)}
 @keyframes breathe{50%{transform:scale(1.06);opacity:.7}}
 .login h1{font-family:"Big Shoulders Display",sans-serif;font-weight:800;font-size:4rem;margin:0;color:var(--ph);
  letter-spacing:.05em;text-shadow:0 0 30px rgba(52,245,160,.45);z-index:1}
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
 .node{background:#06160e;border:1px solid var(--line);border-radius:12px;padding:.9rem;transition:.15s;
  opacity:0;transform:translateY(8px);animation:rise .45s forwards}
 .node:hover{border-color:var(--line2);transform:translateY(-2px)}
 .node .top{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
 .node .online{width:9px;height:9px;border-radius:50%;background:var(--ph);box-shadow:0 0 8px var(--ph);flex:none}
 .node .name{font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
 .node .topic{font-size:.66rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:.6rem}
 .node .foot{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
 .ver{font-size:.66rem;color:#04130c;background:var(--phd);border-radius:20px;padding:.12rem .55rem;font-weight:600}
 .ver.unk{background:#2c3f37;color:var(--muted)}
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
    '<div class="foot">'+v+'<button class="restart-dev" data-topic="'+esc(x.topic)+'">⟳ restart</button></div></div>';
  }).join('');
 }
 function refresh(){loadStatus();loadDevices()}
 async function init(){var ok=await loadStatus();view(ok);if(ok)loadDevices()}

 // events
 $('#loginBtn').addEventListener('click',login);
 $('#pwd').addEventListener('keydown',function(e){if(e.key==='Enter')login()});
 $('#logout').addEventListener('click',logout);
 $('#fleet').addEventListener('click',function(e){var b=e.target.closest('.restart-dev');if(b)cmd(b.dataset.topic,'restart')});
 document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;var a=b.dataset.act;
  if(a==='wifi'){if(!$('#ssid').value)return toast('SSID requis',1);cmd('all','set_wifi',{ssid:$('#ssid').value,pass:$('#wpass').value})}
  else if(a==='mqtt')cmd('all','set_mqtt',{broker:$('#mbroker').value,user:$('#muser').value,pass:$('#mpass').value});
  else if(a==='restart'){if(confirm('Redémarrer TOUS les ESP ?'))cmd('all','restart')}
  else if(a==='ota'){if(!$('#otaurl').value)return toast('URL requise',1);if(confirm('OTA sur TOUS les ESP ?'))cmd('all','ota',{url:$('#otaurl').value})}
 });
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
