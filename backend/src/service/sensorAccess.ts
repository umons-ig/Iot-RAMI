import { Op } from "sequelize";
import db from "@db/index";
import { Status } from "#/sensor";

const DB: any = db;

/**
 * Capteurs accessibles via les ZONES accordées à l'utilisateur (directement
 * ou via ses teams), en CASCADE sur le sous-arbre : un accès « Bâtiment A »
 * donne accès à tous les capteurs des étages/pièces sous A.
 *
 * Source de vérité unique du contrôle d'accès par zone, réutilisée par
 * `measurement.ts` (filtrage des mesures) et le middleware `requireSessionAccess`
 * (lecture/export de sessions).
 */
export const zoneGrantedSensorIds = async (
  userId: string
): Promise<string[]> => {
  try {
    // 1. Zones accordées directement à l'utilisateur.
    const userGrants = await DB.UserZoneAccess.findAll({
      attributes: ["zoneId"],
      where: { userId },
      raw: true,
    });
    // 2. Zones accordées aux teams dont l'utilisateur est membre.
    const memberships = await DB.TeamMember.findAll({
      attributes: ["teamId"],
      where: { userId },
      raw: true,
    });
    const teamIds = memberships.map((m: any) => m.teamId);
    let teamGrants: any[] = [];
    if (teamIds.length > 0) {
      teamGrants = await DB.TeamZoneAccess.findAll({
        attributes: ["zoneId"],
        where: { teamId: { [Op.in]: teamIds } },
        raw: true,
      });
    }

    const grantedZoneIds = new Set<string>([
      ...userGrants.map((g: any) => g.zoneId),
      ...teamGrants.map((g: any) => g.zoneId),
    ]);
    if (grantedZoneIds.size === 0) return [];

    // 3. Expansion au sous-arbre : on construit la table parent -> enfants
    //    puis on descend depuis chaque zone accordée (cascade).
    const allZones = await DB.Zone.findAll({
      attributes: ["id", "parentId"],
      raw: true,
    });
    const childrenMap = new Map<string, string[]>();
    allZones.forEach((z: any) => {
      if (z.parentId) {
        const arr = childrenMap.get(z.parentId) ?? [];
        arr.push(z.id);
        childrenMap.set(z.parentId, arr);
      }
    });
    const expanded = new Set<string>();
    const stack = [...grantedZoneIds];
    while (stack.length) {
      const zid = stack.pop();
      if (!zid || expanded.has(zid)) continue;
      expanded.add(zid);
      for (const c of childrenMap.get(zid) ?? []) stack.push(c);
    }

    // 4. Capteurs rattachés à l'une de ces zones.
    const sensors = await DB.Sensor.findAll({
      attributes: ["id"],
      where: { zoneId: { [Op.in]: Array.from(expanded) } },
      raw: true,
    });
    return sensors.map((s: any) => s.id);
  } catch {
    // Modèles d'accès par zone indisponibles (contexte de test mocké) ou
    // erreur DB : on dégrade en « aucun accès par zone » (fail-closed, deny).
    return [];
  }
};

/**
 * Liste des ids de capteurs auxquels l'utilisateur a accès :
 * capteurs accordés individuellement (UserSensorAccess ACCEPTED)
 * ∪ capteurs des zones accordées (à l'utilisateur ou à ses teams).
 *
 * N.B. : ne court-circuite PAS le rôle admin — l'appelant doit gérer le cas
 * admin (qui voit tout) en amont.
 */
export const getAccessibleSensorIds = async (
  userId: string
): Promise<string[]> => {
  const granted = await DB.UserSensorAccess.findAll({
    attributes: ["sensorId"],
    where: { userId, status: Status.ACCEPTED },
    raw: true,
  });
  const individualIds = granted.map((g: any) => g.sensorId);
  const zoneIds = await zoneGrantedSensorIds(userId);
  return Array.from(new Set<string>([...individualIds, ...zoneIds]));
};

/**
 * Vrai si l'utilisateur a accès au capteur donné (accès direct ou via zone).
 * Fail-closed : toute erreur ou absence d'accès renvoie `false`.
 */
export const userHasSensorAccess = async (
  userId: string,
  sensorId: string
): Promise<boolean> => {
  const direct = await DB.UserSensorAccess.findOne({
    where: { userId, sensorId, status: Status.ACCEPTED },
  });
  if (direct) return true;

  const zoneIds = await zoneGrantedSensorIds(userId);
  return zoneIds.includes(sensorId);
};
