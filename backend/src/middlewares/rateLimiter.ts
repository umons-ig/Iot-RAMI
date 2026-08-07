import rateLimit from "express-rate-limit";

// En test, les suites enchaînent des centaines de requêtes depuis la même IP :
// on relève le plafond pour ne pas transformer le limiteur en source de faux
// négatifs. NODE_ENV vaut "production" en prod (cf. les garde-fous de env.ts),
// jamais "test" : aucun contournement possible en exploitation.
const isTest = process.env.NODE_ENV === "test";

/**
 * Chaque surface d'authentification reçoit sa PROPRE instance : `express-rate-limit`
 * partage un compteur par instance, donc réutiliser un même limiteur sur
 * /auth, /users/login et /users/signup ferait qu'un attaquant épuisant le
 * quota sur l'un bloquerait les deux autres pour toute son IP — un déni de
 * service contre les utilisateurs légitimes derrière un même NAT (hôpital).
 */
const createAuthLimiter = (message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isTest ? 1_000_000 : 20,
    message: {
      status: "error",
      message,
    },
  });

export const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: isTest ? 1_000_000 : 500, // limit each IP to 500 requests per windowMs
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again later.",
  },
});

export const authLimiter = createAuthLimiter(
  "Too many login attempts from this IP, please try again later."
);

// Le login est la cible directe du bruteforce de mots de passe.
export const loginLimiter = createAuthLimiter(
  "Too many login attempts from this IP, please try again later."
);

// L'inscription est publique : sans plafond dédié, elle sert à créer en masse
// des comptes valides (et donc des JWT valides) ou à énumérer les emails.
export const signupLimiter = createAuthLimiter(
  "Too many signup attempts from this IP, please try again later."
);
