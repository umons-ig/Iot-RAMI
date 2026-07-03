import { Request, Response, NextFunction } from "express";
import { Exception, ServerErrorException } from "@utils/exceptions";

/**
 * Middleware d'erreur Express GLOBAL (filet de sécurité), à enregistrer en
 * dernier. Cf. PLAN_AMELIORATIONS §2.4.
 *
 * Avant, un throw synchrone non capturé pouvait faire planter le process et les
 * formats d'erreur étaient incohérents d'un contrôleur à l'autre. Ce handler
 * garantit une réponse JSON uniforme `{ error, code }` et le bon statut HTTP
 * pour toute erreur propagée via `next(err)` ou levée dans un middleware.
 *
 * Les contrôleurs existants gèrent encore leur propre try/catch ; ils peuvent
 * être migrés progressivement vers `next(err)` pour s'appuyer sur ce handler.
 */
const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Si la réponse a déjà commencé, on délègue au handler par défaut d'Express.
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof Exception) {
    res.status(err.status).json({ error: err.message, code: err.codeError });
    return;
  }

  // Erreurs JWT -> 401 (cohérent avec le middleware auth).
  const name = (err as { name?: string } | null)?.name;
  if (name === "TokenExpiredError" || name === "JsonWebTokenError") {
    res
      .status(401)
      .json({ error: "Invalid or expired token", code: "auth.token.invalid" });
    return;
  }

  console.error("[errorHandler] Unhandled error:", err);
  const fallback = new ServerErrorException("Server error !", "server.error");
  res.status(500).json({ error: fallback.message, code: fallback.codeError });
};

export { errorHandler };
