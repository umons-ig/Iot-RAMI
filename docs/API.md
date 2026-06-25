# API REST — Reference

Base URL : `http://<host>:3000/api/v1`

Documentation interactive Swagger disponible sur : `GET /api/v1/docs`

## Authentification

La plupart des routes protegees utilisent un token JWT transmis dans le header :

```
Authorization: Bearer <token>
```

Les routes marquees **[auth]** requierent un token valide. Les routes marquees **[admin]** requierent un role `admin`.

---

## Auth

| Methode | Route           | Auth | Description                                                |
|---------|-----------------|------|------------------------------------------------------------|
| `POST`  | `/auth`         | auth | Verification du token JWT                                  |
| `POST`  | `/auth/refresh` | -    | Rotation du refresh token — retourne un nouvel access token (15min) via le cookie HttpOnly (7j) |
| `POST`  | `/auth/logout`  | -    | Invalide le refresh token (efface le cookie)               |

La connexion est geree via `POST /users/login` (retourne l'access token JWT + pose le cookie refresh token).

---

## Utilisateurs — `/users`

| Methode  | Route                                       | Auth   | Description                                      |
|----------|---------------------------------------------|--------|--------------------------------------------------|
| `POST`   | `/users/login`                              | -      | Connexion, retourne un JWT                       |
| `POST`   | `/users/signup`                             | -      | Creation de compte                               |
| `PUT`    | `/users/update`                             | auth   | Mise a jour des informations utilisateur         |
| `PUT`    | `/users/update/role`                        | admin  | Mise a jour du role d'un utilisateur             |
| `GET`    | `/users/verify/adminPanel`                  | auth   | Verifie si l'utilisateur a acces au panel admin  |
| `GET`    | `/users/all`                                | auth   | Liste les utilisateurs (roles inferieurs/egaux)  |
| `GET`    | `/users/:id/sessions`                       | auth   | Sessions d'un utilisateur                        |
| `GET`    | `/users/:id/sessions/on/sensor/:idSensor`   | auth   | Sessions d'un utilisateur sur un capteur donne   |

### Acces aux capteurs (grain fin, par capteur)

| Methode  | Route                          | Auth   | Description                                      |
|----------|--------------------------------|--------|--------------------------------------------------|
| `POST`   | `/users/sensors/access`        | admin  | Donne acces a un capteur a des utilisateurs      |
| `DELETE` | `/users/sensors/access`        | admin  | Retire l'acces a un capteur                      |
| `GET`    | `/users/sensors/access`        | admin  | Liste tous les acces capteurs                    |
| `POST`   | `/users/sensors/access/ask`    | auth   | Demande d'acces a un capteur existant            |

> Pour donner acces a **un ensemble de capteurs d'un coup**, voir l'acces par
> **zone** (`/zones/:id/access`) et les **equipes** (`/teams`) ci-dessous.

---

## Capteurs — `/sensors`

| Methode  | Route                              | Auth  | Description                                         |
|----------|------------------------------------|-------|-----------------------------------------------------|
| `GET`    | `/sensors`                         | auth  | Liste tous les capteurs (admin) ou ceux de l'utilisateur |
| `POST`   | `/sensors`                         | admin | Cree un nouveau capteur                             |
| `GET`    | `/sensors/:id`                     | auth  | Recupere un capteur par ID                          |
| `PUT`    | `/sensors/:id`                     | auth  | Met a jour un capteur                               |
| `DELETE` | `/sensors/:id`                     | auth  | Supprime un capteur                                 |
| `GET`    | `/sensors/:id/sessions`            | -     | Liste les sessions d'un capteur                     |
| `GET`    | `/sensors/:id/topic`               | -     | Retourne le topic MQTT d'un capteur                 |
| `GET`    | `/sensors/discovered`              | -     | Liste les topics detectes mais non enregistres      |
| `GET`    | `/sensors/connexion/online/:name`  | -     | Statut en ligne d'un capteur (`publishing`/`offline`) |

### Schema capteur

```json
{
  "id": "uuid",
  "name": "ESP32-DHT22",
  "topic": "esp32-dht22-topic"
}
```

---

## Zones — `/zones`

Hierarchie de localisation en **arbre recursif** (entreprise > batiment > etage > piece > …). Un capteur est rattache a une zone-feuille (`Sensor.zoneId`). Accorder l'acces a une zone donne acces, **en cascade**, a tous les capteurs de son sous-arbre.

| Methode  | Route                    | Auth  | Description                                                       |
|----------|--------------------------|-------|------------------------------------------------------------------|
| `GET`    | `/zones`                 | auth  | Liste plate de toutes les zones (triees par nom)                 |
| `POST`   | `/zones`                 | admin | Cree une zone (`{ name, type?, parentId? }`)                     |
| `GET`    | `/zones/tree`            | auth  | Arbre imbrique + compteur de capteurs **visibles** par zone      |
| `GET`    | `/zones/:id`             | auth  | Une zone avec ses enfants et ses capteurs visibles               |
| `PUT`    | `/zones/:id`             | admin | Met a jour `{ name?, type?, parentId? }` (anti-cycle au reparentage) |
| `DELETE` | `/zones/:id`             | admin | Supprime une zone (refus si non vide, sauf `?cascade=true`)      |
| `GET`    | `/zones/:id/sensors`     | auth  | Capteurs de la zone (filtres par acces de l'utilisateur)         |
| `PUT`    | `/zones/:id/sensors`     | admin | Rattache un capteur (`{ sensorId }`) ; `:id = none` pour detacher |
| `GET`    | `/zones/:id/access`      | admin | Users et equipes ayant un acces **direct** a la zone             |
| `POST`   | `/zones/:id/access`      | admin | Accorde l'acces a la zone (`{ userId }` **ou** `{ teamId }`)     |
| `DELETE` | `/zones/:id/access`      | admin | Retire l'acces (`{ userId }` **ou** `{ teamId }`)               |

> **Suppression en cascade** : la FK `parentId` est `ON DELETE CASCADE` (supprimer une zone supprime son sous-arbre) ; `Sensor.zoneId` est `ON DELETE SET NULL` (les capteurs deviennent « non classes »).

### Schema zone

```json
{
  "id": "uuid",
  "name": "Batiment A",
  "type": "building",
  "parentId": "uuid | null"
}
```

---

## Equipes — `/teams`

Groupes d'utilisateurs. Une equipe peut recevoir l'acces a une zone (`/zones/:id/access` avec `teamId`) : tous ses membres voient alors, en cascade, les capteurs du sous-arbre.

| Methode  | Route                          | Auth  | Description                                          |
|----------|--------------------------------|-------|------------------------------------------------------|
| `GET`    | `/teams`                       | auth  | Liste toutes les equipes                             |
| `POST`   | `/teams`                       | admin | Cree une equipe (`{ name }`)                        |
| `GET`    | `/teams/:id`                   | auth  | Une equipe avec ses membres et ses zones accordees   |
| `PUT`    | `/teams/:id`                   | admin | Renomme l'equipe (`{ name }`)                       |
| `DELETE` | `/teams/:id`                   | admin | Supprime l'equipe (cascade sur membres et grants)    |
| `POST`   | `/teams/:id/members`           | admin | Ajoute un membre (`{ userId }`)                     |
| `DELETE` | `/teams/:id/members/:userId`   | admin | Retire un membre                                     |

### Modele d'acces effectif

L'ensemble des capteurs visibles par un utilisateur =
**acces individuels** (`/users/sensors/access`) ∪ **capteurs des zones** accordees a l'utilisateur (`UserZoneAccess`) ∪ **capteurs des zones** accordees a ses equipes (`TeamZoneAccess`), le tout **en cascade** sur les sous-arbres. Les admins voient tout.

---

## Sessions — `/sessions`

| Methode  | Route                     | Auth | Description                                           |
|----------|---------------------------|------|-------------------------------------------------------|
| `GET`    | `/sessions`               | -    | Liste toutes les sessions                             |
| `GET`    | `/sessions/active`        | -    | Liste les sessions en cours (`endedAt` = null)        |
| `POST`   | `/sessions/new`           | -    | Cree une session et retourne le topic + sessionId     |
| `POST`   | `/sessions/new/on/server` | -    | Cloture une session (met `endedAt`)                   |
| `GET`    | `/sessions/:id`           | -    | Recupere une session par ID                           |
| `DELETE` | `/sessions/:id`           | -    | Supprime une session et ses donnees                   |
| `DELETE` | `/sessions`               | -    | Supprime toutes les sessions                          |
| `GET`    | `/sessions/:id/data`      | -    | Retourne les donnees de mesure de la session          |
| `GET`    | `/sessions/:id/export/csv`| -    | Exporte les donnees de la session en CSV              |

### Schema session

```json
{
  "id": "uuid",
  "idSensor": "uuid",
  "idFog": "fog-service",
  "createdAt": "2026-01-01T10:00:00.000Z",
  "endedAt": "2026-01-01T10:30:00.000Z"
}
```

`endedAt` vaut `null` si la session est en cours.

### Format CSV exporte

```csv
# session_id,<uuid>
# sensor_id,<uuid>
# sensor_name,ESP32-DHT22
# sensor_topic,esp32-dht22-topic
# start_time,2026-01-01T10:00:00.000Z
# end_time,2026-01-01T10:30:00.000Z
time,value,type
2026-01-01T10:00:01.000Z,23.5,temperature
2026-01-01T10:00:01.000Z,61.2,humidity
```

---

## Types de mesures — `/measurementTypes`

| Methode  | Route                    | Auth | Description                               |
|----------|--------------------------|------|-------------------------------------------|
| `GET`    | `/measurementTypes`      | -    | Liste tous les types de mesures           |
| `GET`    | `/measurementTypes/:id`  | -    | Recupere un type par ID                   |
| `POST`   | `/measurementTypes`      | -    | Cree un type de mesure                    |
| `PUT`    | `/measurementTypes/:id`  | -    | Met a jour un type de mesure              |
| `DELETE` | `/measurementTypes/:id`  | -    | Supprime un type de mesure                |

Types predefinis (seed) : `ecg`, `temperature`, `humidity`.

### Schema type de mesure

```json
{
  "id": "uuid",
  "name": "temperature"
}
```

---

## Mesures — `/measurements`

| Methode  | Route                 | Auth | Description                               |
|----------|-----------------------|------|-------------------------------------------|
| `GET`    | `/measurements`       | -    | Liste toutes les mesures                  |
| `GET`    | `/measurements/:id`   | -    | Recupere une mesure par ID                |
| `POST`   | `/measurements`       | -    | Cree une mesure                           |
| `POST`   | `/measurements/bulk`  | -    | Cree plusieurs mesures en lot             |
| `PUT`    | `/measurements/:id`   | -    | Met a jour une mesure                     |
| `DELETE` | `/measurements/:id`   | -    | Supprime une mesure                       |

---

## Seuils d'alerte — `/thresholds`

Un seuil definit des valeurs minimale et/ou maximale pour un type de mesure sur un capteur donne. Lorsqu'une mesure recue depasse ces limites, une alerte est emise en temps reel via Socket.io a tous les utilisateurs ayant acces au capteur ainsi qu'aux administrateurs.

La contrainte d'unicite est `(idSensor, idMeasurementType)` : un seul seuil par couple capteur/type de mesure.

| Methode  | Route                            | Auth | Description                                     |
|----------|----------------------------------|------|-------------------------------------------------|
| `POST`   | `/thresholds`                    | auth | Cree un seuil pour un capteur et un type de mesure |
| `GET`    | `/thresholds/sensor/:idSensor`   | auth | Recupere tous les seuils d'un capteur           |
| `PUT`    | `/thresholds/:id`                | auth | Met a jour les valeurs min/max d'un seuil       |
| `DELETE` | `/thresholds/:id`                | auth | Supprime un seuil                               |

### Schema seuil

```json
{
  "id": "uuid",
  "idSensor": "uuid",
  "idMeasurementType": "uuid",
  "minValue": 10.0,
  "maxValue": 100.0
}
```

`minValue` et `maxValue` sont optionnels (peuvent valoir `null`). Un seuil avec uniquement `minValue` ou uniquement `maxValue` est valide.

### POST `/thresholds` — Creer un seuil

Corps de la requete :

```json
{
  "idSensor": "uuid",
  "idMeasurementType": "uuid",
  "minValue": 10.0,
  "maxValue": 100.0
}
```

`idSensor` et `idMeasurementType` sont obligatoires. `minValue` et `maxValue` sont optionnels.

Reponses :

| Code | Description                                          |
|------|------------------------------------------------------|
| 201  | Seuil cree — retourne l'objet complet                |
| 400  | `idSensor` ou `idMeasurementType` manquant — code `threshold.missing.fields` |
| 500  | Erreur interne — code `threshold.internal.error`     |

### GET `/thresholds/sensor/:idSensor` — Seuils d'un capteur

Retourne un tableau de tous les seuils configures pour le capteur identifie par `idSensor`.

Reponses :

| Code | Description                                           |
|------|-------------------------------------------------------|
| 200  | Tableau de seuils                                     |
| 404  | Aucun seuil trouve — code `threshold.not.found`       |
| 500  | Erreur interne — code `threshold.internal.error`      |

### PUT `/thresholds/:id` — Mettre a jour un seuil

Corps de la requete (les deux champs sont optionnels — les valeurs non fournies sont conservees) :

```json
{
  "minValue": 20.0,
  "maxValue": 200.0
}
```

Reponses :

| Code | Description                                           |
|------|-------------------------------------------------------|
| 200  | Seuil mis a jour — retourne l'objet modifie           |
| 404  | Seuil introuvable — code `threshold.not.found`        |
| 500  | Erreur interne — code `threshold.internal.error`      |

### DELETE `/thresholds/:id` — Supprimer un seuil

Reponses :

| Code | Description                                           |
|------|-------------------------------------------------------|
| 200  | `{ "message": "Threshold deleted successfully." }`    |
| 404  | Seuil introuvable — code `threshold.not.found`        |
| 500  | Erreur interne — code `threshold.internal.error`      |

### Alertes en temps reel (Socket.io)

Quand une mesure recue depasse un seuil configure, le backend emet l'evenement `threshold-alert` sur la room `user-{userId}` de chaque utilisateur ayant acces au capteur et de chaque administrateur.

Pour recevoir ces alertes, le client doit d'abord rejoindre sa room personnelle :

```js
socket.emit("join-user-room", { token: "<JWT>" });
```

Puis ecouter l'evenement :

```js
socket.on("threshold-alert", (alert) => {
  // alert = {
  //   sensorTopic: "esp32-dht22-topic/sensor",
  //   measureType: "temperature",
  //   value: 105.3,
  //   minValue: 10.0,
  //   maxValue: 100.0,
  //   direction: "max",       // "min" | "max"
  //   triggeredAt: "2026-01-01T10:05:00.000Z"
  // }
});
```

`direction: "min"` signifie que la valeur est en dessous du seuil minimal. `direction: "max"` signifie qu'elle depasse le seuil maximal.

Le cache des seuils cote backend a une duree de vie de 60 secondes (TTL configurable). Une modification de seuil est donc prise en compte au plus en 60 secondes par le moteur d'alerte.

---

## WebSocket — Socket.io

Le backend expose un serveur Socket.io sur le meme port que l'API REST (port 3000).

### Connexion et authentification

A la connexion, le client doit s'abonner a un topic de session :

```js
socket.emit("join-session", {
  token: "<JWT>",
  topic: "esp32-dht22-topic/sensor"
});
```

Le serveur verifie le JWT. En cas de succes, il repond :

```js
socket.on("joined", ({ topic }) => { /* topic confirme */ });
```

En cas de token invalide, la connexion est fermee immediatement.

### Reception des donnees en temps reel

Une fois abonne, le client recoit les messages Kafka de type `data` :

```js
socket.on("new-data", (data) => {
  // data = { type: "data", sensorTopic, measures: [...] }
});
```

### Statut des capteurs

Ecoutable depuis n'importe quel client connecte (pas de room) :

```js
socket.on("sensor-status", ({ sensorName, status }) => {
  // status = "online" | "offline" | "publishing"
});
```
