import { Request, Response } from "express";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServerErrorException,
  UnauthorizedException,
} from "@utils/exceptions";
import jwt from "jsonwebtoken";
import { Role, UserPayload } from "#/user";
import { envs } from "@utils/env";
import db from "@db/index";
import { userHasSensorAccess } from "@service/sensorAccess";

const DB: any = db;

const verifyToken = (req: Request): UserPayload => {
  // Check if token is valid (in header in bearer format)
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new BadRequestException("Invalid token !", "auth.token.invalid");
  }
  const secret = envs.JWT_SECRET;

  const payload = jwt.verify(token, secret) as UserPayload;
  if (!payload) {
    throw new UnauthorizedException("Unauthorized !", "auth.token.invalid");
  }
  return payload;
};

const handleAuthError = (error: unknown, res: Response) => {
  // Détection par `name` plutôt que par `instanceof jwt.X` : robuste quel que
  // soit le mock de jsonwebtoken dans les tests (les vraies erreurs jwt portent
  // bien name="TokenExpiredError"/"JsonWebTokenError").
  const errorName = (error as { name?: string } | null)?.name;
  switch (true) {
    case error instanceof BadRequestException:
      res.status(400).json(error);
      break;
    case error instanceof UnauthorizedException:
      res.status(401).json(error);
      break;
    // Un token expiré/malformé est une erreur d'AUTH (401), pas une erreur
    // serveur (500). Avant ce mapping, jwt.verify levait une exception qui
    // tombait dans le default -> 500, ce qui cassait le flux de refresh côté
    // front et masquait la vraie cause. Cf. PLAN_AMELIORATIONS §0.5.
    case errorName === "TokenExpiredError":
      res
        .status(401)
        .json(
          new UnauthorizedException("Token expired !", "auth.token.expired")
        );
      break;
    case errorName === "JsonWebTokenError":
      res
        .status(401)
        .json(
          new UnauthorizedException("Invalid token !", "auth.token.invalid")
        );
      break;
    default:
      res
        .status(500)
        .json(new ServerErrorException("Server error !", "server.error"));
      break;
  }
};

const auth = (req: Request, res: Response, next: () => void) => {
  try {
    req.user = verifyToken(req);
    next();
  } catch (error) {
    handleAuthError(error, res);
  }
};

const requireRole =
  (role: Role) => (req: Request, res: Response, next: () => void) => {
    try {
      const payload = verifyToken(req);
      if (payload.role !== role) {
        res
          .status(401)
          .json(
            new UnauthorizedException(
              "Unauthorized !",
              "auth.token.unauthorized"
            )
          );
        return;
      }
      req.user = payload;
      next();
    } catch (error) {
      handleAuthError(error, res);
    }
  };

const authAdmin = requireRole(Role.ADMIN);

/**
 * Vérifie que l'utilisateur authentifié a le droit d'accéder à la session
 * désignée par `req.params.id` (via l'accès au capteur sous-jacent).
 *
 * À chaîner APRÈS `auth` (qui pose `req.user`). Les admins passent toujours.
 * - Session introuvable          -> 404
 * - Pas d'accès au capteur        -> 403
 *
 * Ferme l'IDOR sur les routes de lecture/export de session : sans ce garde,
 * tout compte authentifié pouvait lire les données (ECG) de n'importe quel
 * capteur. Voir docs/PLAN_AMELIORATIONS.md §0.1.
 */
const requireSessionAccess = async (
  req: Request,
  res: Response,
  next: () => void
) => {
  try {
    const user = req.user as UserPayload;
    if (user?.role === Role.ADMIN) {
      return next();
    }

    const session = await DB.Session.findByPk(req.params.id);
    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }

    const idSensor = session.dataValues?.idSensor ?? session.idSensor;
    const allowed = await userHasSensorAccess(user.userId, idSensor);
    if (!allowed) {
      return res
        .status(403)
        .json(
          new ForbiddenException(
            "You do not have access to this session",
            "session.access.forbidden"
          )
        );
    }

    return next();
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error !", "server.error"));
  }
};

export { auth, verifyToken, authAdmin, requireRole, requireSessionAccess };
