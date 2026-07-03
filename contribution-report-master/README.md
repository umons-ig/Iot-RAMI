# Projet 

### Nom:
RAMI (Real-Time Internet of Medical Things Architecture for Elderly Patient Monitoring)

### Technologies utilisées: 
- Langages : Python (simulateur), C++ (arduino), TypeScript et JavaScript (fullstack) 
- Frameworks : Node.js, Vue.js
- Protocoles : MQTT pour la communication des données
- Bases de Données : TimescaleDB pour les séries temporelles (extension de PostgreSQL)
- Outils : Docker, GitLab, VSCode
- OS utilisé lors du développement: Linux

---

### Utilisation de ce dépôt

Après la rédaction de votre rapport, vous devez l'ajouter à ce dépôt. Pour cela, mettre votre rapport au sein de ce dépôt puis éxécuter:
```bash
python3 ./update_readme.py [nom_du_rapport.pdf]
```

Puis laissez vous guider par le script.
- Le script renomme votre rapport avec un nom de fichier standardisé.
- Le script ajoute une section à votre nom dans le fichier README.md sous la forme : Contribution de {contributor_name}, {start_date} - {end_date} ({months_duration} mois) "
1) Trouvez cette section dans le README.md et copiez le titre. Collez-le ensuite dans la section "Tous les contributeurs".
2) Revenez à votre section dans le README.md. Complétez-la ou supprimez les éléments pour lesquels vous ne souhaitez pas fournir de détails.

---
### Tous les contributeurs:

- RAMI App Mobile : Contribution de Dounia, 2022-05-22 - 2022-07-31 (3 mois)
- RAMI 0 : Contribution de Thomas, 2023-04-17 - 2023-09-15 (5 mois)
- RAMI 0 : Contribution de Lilian, 2023-05-08 - 2023-08-08 (3 mois)
- RAMI 1.0 : Contribution de Cyril,  2024-04-08 - 2024-07-08 (3 mois)
- RAMI 1.0 : Contribution de Gaspard

---
### RAMI 1.0 : Contribution de Cyril, 2024-04-08 - 2024-07-08 (3 mois)
- Transition de HTTP à MQTT pour la communication des données
- Intégration de TimescaleDB pour les séries temporelles
- Ajout de fonctionnalités pour la visualisation des données dans le frontend
- Mise en place des dépôts python-simulator-over-mqtt, sensors-over-mqtt, et contribution-report

#### Conseils d'ensemble
1) Lisez les rapports de stage précédents, notamment le mien (j'ai tenté d'expliquer petit à petit toute la démarche et la transition depuis RAMI0), pour éviter de répéter les mêmes erreurs et pour vous inspirer des bonnes pratiques.

2) Consultez les README.md de chaque dépôt pour les instructions spécifiques au backend et frontend de RAMI. **ATTENTION: après le git clone, vous devez aller dans la branche RAMI1-dev avant de poursuivre les instructions du README** Chaque dépôt est accompagné d’un README.md, lisez-le attentivement et complétez-le si nécessaire.

3) Clonez tous les dépôts, puis commencez par le simulateur (python-simulator-over-mqtt). Ensuite, testez une interaction entre un capteur réel (sensors-over-mqtt) et le simulateur, puis entre le capteur et RAMI (backend et frontend). Cette approche progressive est mentionnée dans l'annexe 1 de mon rapport.

4) Pour VSCode, installez les extensions Git Graph et Thunder Client.

5) N'oubliez pas d'ajouter votre rapport dans le dépôt puis d'exécuter (voir la partie "Utilisation de ce dépôt" ):
```bash
python3 ./update_readme.py [nom_du_rapport.pdf]
```

#### Conseils techniques

##### Electronique
- Préférez les pointeurs et références en C++ pour optimiser la gestion de la mémoire sur les microcontrôleurs. Utilisez PROGMEM pour les chaînes lourdes et peu accédées.
- Évitez les prints lors de l’envoi de messages à très haute vitesse, car ils ralentissent le programme.
- Git et Arduino ne sont pas parfaitement compatibles. Modifiez votre code dans VSCode, mais effectuez la compilation et le flashage dans Arduino.

##### Informatique (Backend)
- Suivez les conventions d’association dans les modèles, en vous inspirant des anciens modèles (dossier types et models).
- Les prints dans MqttServer aident à comprendre les interactions broker-serveur, mais commentez-les lors des tests sinon ces derniers lèveront des erreurs.
- Implémentez des tests unitaires pour chaque nouvelle fonction ou modification de code. Le CI/CD de RAMI impose ces tests, donc anticipez en rédigeant un cahier des charges.
- Pour les seeders, le mot de passe correspond à l’adresse email, sauf pour l'utilisateur Cyril, le mdp est cyrilclovis@gmail.com, n’hésitez pas à me contacter à cette adresse.

##### Informatique (Frontend)
- Favorisez la réutilisabilité de vos composants web.

---
### RAMI 1.0 : Contribution de Gaspard
- Refonte de l'architecture temps réel : remplacement de la connexion MQTT directe navigateur par un pipeline WebSocket (Socket.io) sécurisé via JWT
- Mise en place de l'architecture fog/cloud : fog-service Node.js sur Raspberry Pi (MQTT → Kafka batch), sessions pilotées par le fog
- Support multi-mesures (ECG, temperature, humidite) avec datasets dynamiques dans le graphique
- Auto-decouverte des capteurs inconnus via MQTT wildcard `#`
- Mise à jour des sketches Arduino (DHT22, ECG AD8232) : format multi-mesures, portail captif WiFiManager, PING periodique
- Simulateur Python : nouveau protocole fog (PING/START/ACK/STOP), arguments CLI, Ctrl+C propre
- CI/CD GitHub Actions : lint → test → docker build → push GHCR → déploiement auto Watchtower
- Tests : 348 tests Jest (backend) + 137 tests Vitest (frontend)
- Documentation complète : MQTT, Kafka, API REST, scenario de demo, rapport de contribution
