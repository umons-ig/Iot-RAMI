import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServerErrorException,
  UnauthorizedException,
} from "@utils/exceptions";
// Model(s) import
import db from "@db/index";
import { getAccessibleSensorIds } from "@service/sensorAccess";
const DB: any = db;
const { User, Session } = DB;
// --- End of model(s) import
import {
  isBetterThan,
  isStrictlyBetterThan,
  Role,
  Sex,
  User as UserType,
  UserPayload,
} from "#/user";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { envs } from "@utils/env";

const checkPasswordLength = (password: string) => {
  if (password.length < 12) {
    throw new BadRequestException(
      "Password too short !",
      "user.password.too.short"
    );
  }

  if (password.length > 255) {
    throw new BadRequestException(
      "Password too long !",
      "user.password.too.long"
    );
  }
};

const checkFirstNameLength = (firstName: string) => {
  if (firstName.length > 60) {
    throw new BadRequestException(
      "First Name too long !",
      "user.first.name.too.long"
    );
  }

  if (firstName.length < 2) {
    throw new BadRequestException(
      "First Name too short !",
      "user.first.name.too.short"
    );
  }
};

const checkLastNameLength = (lastName: string) => {
  if (lastName.length > 60) {
    throw new BadRequestException(
      "Last Name too long !",
      "user.last.name.too.long"
    );
  }

  if (lastName.length < 2) {
    throw new BadRequestException(
      "Last Name too short !",
      "user.last.name.too.short"
    );
  }
};

const checkSex = (sex: string) => {
  if (!Object.values(Sex).includes(sex as Sex)) {
    throw new BadRequestException("User sex is invalid!", "user.sex.invalid");
  }
};

const checkEmail = (email: string) => {
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new BadRequestException("Invalid email !", "user.email.not.valid");
  }
};

const checkDate = (date: string) => {
  if (!new Date(date).getTime()) {
    throw new BadRequestException(
      "Invalid date format!",
      "user.date.of.birth.not.valid"
    );
  }
};

const generateUserResponse = (
  user: UserType,
  res: Response,
  token?: string
) => {
  if (!token) {
    const secret = envs.JWT_SECRET;
    const payload = {
      userId: user.id,
      role: user.role,
    };
    const refreshPayload = {
      userId: user.id,
      role: user.role,
      refreshTokenVersion: (user as any).refreshTokenVersion ?? 0,
    };
    token = jwt.sign(payload, secret, {
      expiresIn: envs.JWT_EXPIRATION as any,
    });
    const refreshToken = jwt.sign(refreshPayload, envs.REFRESH_TOKEN_SECRET, {
      expiresIn: envs.REFRESH_TOKEN_EXPIRATION as any,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  // Source de vérité unique de l'expiration : le claim `exp` du token lui-même
  // (en secondes). Avant, expiresAt était codé en dur (12h au login / 15min au
  // refresh) sans rapport avec l'expiration réelle du JWT, ce qui désynchronisait
  // le front. Cf. PLAN_AMELIORATIONS §0.6.
  const decodedAccess = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decodedAccess?.exp
    ? decodedAccess.exp * 1000
    : Date.now() + 15 * 60 * 1000;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    sex: user.sex,
    role: user.role,
    expiresAt,
    token,
  };
};

const signup = async (req: Request, res: Response) => {
  try {
    // Check if body is valid
    const { firstName, lastName, dateOfBirth, sex, email, password } = req.body;
    if (
      !firstName ||
      !lastName ||
      !dateOfBirth ||
      !sex ||
      !email ||
      !password ||
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof dateOfBirth !== "string" ||
      typeof sex !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      firstName === "" ||
      lastName === "" ||
      dateOfBirth === "" ||
      sex === "" ||
      email === "" ||
      password === ""
    ) {
      throw new BadRequestException("Invalid body !", "user.body.invalid");
    }

    checkPasswordLength(password);
    checkFirstNameLength(firstName);
    checkLastNameLength(lastName);
    checkDate(dateOfBirth);
    checkSex(sex);
    checkEmail(email);

    // Check email does not already exist
    const user = await User.findOne({ where: { email } });
    if (user) {
      // NB (audit) : cette réponse confirme l'existence d'un compte
      // (énumération). Choix ASSUMÉ — le front en a besoin pour guider l'usager,
      // et masquer le seul message serait inutile puisque le code d'erreur
      // voyage dans la même réponse. L'exploitation de masse est bornée par
      // `signupLimiter` (20 tentatives / 15 min par IP, cf. app.ts).
      throw new BadRequestException(
        "Email already used !",
        "user.email.already.used"
      );
    }

    // Create user with hashed password
    const hashedPassword = await bcrypt.hash(password, envs.BCRYPT_SALT_ROUNDS);
    const newUser = await User.create({
      firstName,
      lastName,
      dateOfBirth: new Date(dateOfBirth),
      sex,
      email,
      password: hashedPassword,
      role: Role.REGULAR,
    });

    const responseData = generateUserResponse(newUser, res);
    return res.status(201).json(responseData);
  } catch (error) {
    if (error instanceof BadRequestException) {
      return res.status(400).json(error);
    } else {
      return res
        .status(500)
        .json(new ServerErrorException("Server error !", "server.error"));
    }
  }
};

const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  let statusCode = 200;
  let responseData = {};
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    email === "" ||
    password === ""
  ) {
    statusCode = 400;
    responseData = new BadRequestException(
      "Invalid credentials !",
      "user.credentials.invalid"
    );
  } else {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        statusCode = 400;
        responseData = new BadRequestException(
          "Invalid email or password !",
          "user.credentials.invalid"
        );
      } else {
        // Compare hashed password
        let result = false;
        if (typeof user.dataValues.password === "string") {
          result = await bcrypt.compare(password, user.dataValues.password);
        }
        if (result) {
          responseData = generateUserResponse(user, res);
        } else {
          statusCode = 400;
          responseData = new BadRequestException(
            "Invalid email or password !",
            "user.credentials.invalid"
          );
        }
      }
    } catch (e) {
      statusCode = 500;
      responseData = new ServerErrorException("Server error !", "server.error");
    }
  }
  return res.status(statusCode).json(responseData);
};

const updateUserInformation = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, sex, email, password, newPassword } = req.body;
    const payload = req.user as UserPayload;

    if (
      !firstName ||
      !lastName ||
      !sex ||
      !email ||
      !password ||
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof sex !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      firstName === "" ||
      lastName === "" ||
      sex === "" ||
      email === "" ||
      password === ""
    ) {
      return res
        .status(400)
        .json(new BadRequestException("Invalid body !", "user.body.invalid"));
    }

    if (newPassword && typeof newPassword !== "string") {
      return res
        .status(400)
        .json(new BadRequestException("Invalid body !", "user.body.invalid"));
    }

    try {
      checkFirstNameLength(firstName);
      checkLastNameLength(lastName);
      checkSex(sex);
      checkEmail(email);

      if (newPassword) {
        checkPasswordLength(newPassword);
      }
    } catch (error) {
      return res.status(400).json(error);
    }

    // Now, we need to get the current user
    // 1) We get the current user id by using the payload attached by the auth middleware
    const currentUserId = payload.userId;

    // 2) Let's find the user in the database
    const user = await User.findByPk(currentUserId);
    if (!user) {
      return res
        .status(400)
        .json(new BadRequestException("User not found !", "user.not.found"));
    }

    // Check email does not already exist (and if exists, this is not our current user's)
    const userWithCorrespondingEmail = await User.findOne({ where: { email } });
    if (userWithCorrespondingEmail) {
      // Ok, we find out a user with the corresponding email. But if it's our current User, this is not a problem !!!
      if (user.id !== userWithCorrespondingEmail.id) {
        return res
          .status(400)
          .json(
            new BadRequestException(
              "Email already used !",
              "user.email.already.used"
            )
          );
      }
    }

    // Here, we check that the current user password is the same as the one precised by the client
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json(
          new UnauthorizedException(
            "Invalid credentials !",
            "user.credentials.invalid"
          )
        );
    }

    // You can update your profile without defining a new password, but you can also give a new password
    const updatedData: any = {
      firstName,
      lastName,
      sex,
      email,
    };

    if (newPassword) {
      updatedData.password = await bcrypt.hash(
        newPassword,
        envs.BCRYPT_SALT_ROUNDS
      );
      // Changer son mot de passe DOIT invalider les sessions ouvertes ailleurs :
      // sans cette incrémentation, le refresh token d'un attaquant restait
      // valable 7 jours, donc le geste réflexe après une compromission (« je
      // change mon mot de passe ») ne le déconnectait pas.
      updatedData.refreshTokenVersion =
        ((user as any).refreshTokenVersion ?? 0) + 1;
    }

    const updatedUser = await user.update(updatedData);

    if (!updatedUser) {
      return res
        .status(500)
        .json(new ServerErrorException("Server error !", "server.error"));
    }

    // Après rotation de la version, l'ancien refresh token n'est plus valable :
    // on en réémet un pour la session courante, sinon l'utilisateur qui vient de
    // changer son mot de passe serait déconnecté à son prochain refresh.
    const currentToken = newPassword
      ? undefined
      : req.headers.authorization?.split(" ")[1];
    const responseData = generateUserResponse(updatedUser, res, currentToken);
    return res.status(200).json(responseData);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error !", "server.error"));
  }
};

const updateRole = async (req: Request, res: Response) => {
  const { email, role } = req.body;
  const payload = req.user as UserPayload;
  const roleEnum = role as Role;

  if (
    !email ||
    !role ||
    typeof email !== "string" ||
    typeof role !== "string" ||
    email === "" ||
    role === ""
  ) {
    return res
      .status(400)
      .json(new BadRequestException("Invalid body !", "user.body.invalid"));
  }

  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res
      .status(400)
      .json(new BadRequestException("Invalid email !", "user.email.not.valid"));
  }

  if (!Object.values(Role).includes(roleEnum)) {
    // check if role is valid (ADMIN, PRIVILEGED, REGULAR)
    return res
      .status(400)
      .json(new BadRequestException("Invalid role !", "user.role.not.valid"));
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(400)
        .json(new BadRequestException("User not found !", "user.not.found"));
    }

    if (isStrictlyBetterThan(payload.role, roleEnum)) {
      return res
        .status(401)
        .json(
          new UnauthorizedException(
            "You can't update a user with a better role than you !",
            "user.role.not.enough.permissions"
          )
        );
    }
    const updatedUser = await User.update(
      { role: roleEnum },
      { where: { email } }
    );
    if (!updatedUser) {
      return res
        .status(500)
        .json(new ServerErrorException("Server error !", "server.error"));
    }
    return res
      .status(200)
      .json({ message: "User updated with role " + roleEnum + " !" });
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error !", "server.error"));
  }
};

const haveRightsToAcessToAdminPanel = async (req: Request, res: Response) => {
  const decodedToken = req.user as UserPayload;

  try {
    if (isBetterThan(decodedToken.role, Role.PRIVILEGED)) {
      return res
        .status(401)
        .json(
          new UnauthorizedException(
            "You don't have enough rights to access to admin panel !",
            "user.role.not.enough.permissions"
          )
        );
    }
    return res
      .status(200)
      .json({ message: "You have enough rights to access to admin panel !" });
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error !", "server.error"));
  }
};

const getAllRoleWithWorseRoleThan = (role: Role) => {
  const roles = Object.values(Role);
  const index = roles.indexOf(role);
  if (index === -1 || index === roles.length - 1) {
    return [];
  }
  return roles.slice(index + 1, roles.length);
};

const getAllRoleWithWorseRole = async (req: Request, res: Response) => {
  const decodedToken = req.user as UserPayload;

  try {
    const roles = getAllRoleWithWorseRoleThan(decodedToken.role);
    if (roles.length === 0) {
      return res
        .status(401)
        .json(
          new UnauthorizedException(
            "You don't have enough rights to get all users with worse role than you !",
            "user.role.not.enough.permissions"
          )
        );
    }
    // `exclude: password` impératif : sans lui, la réponse embarquait le hash
    // bcrypt de chaque utilisateur, servi tel quel au navigateur (cassage hors
    // ligne + réutilisation de mot de passe).
    const users = await User.findAll({
      where: { role: roles },
      attributes: { exclude: ["password"] },
    });
    if (!users) {
      return res
        .status(404)
        .json(new NotFoundException("No user found !", "user.not.found"));
    }
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error !", "server.error"));
  }
};

const getUserSessions = async (req: Request, res: Response) => {
  const { id, idSensor } = req.params;
  const requester = req.user as UserPayload;
  const isAdmin = requester?.role === Role.ADMIN;

  // Un utilisateur non-admin ne peut consulter QUE ses propres sessions.
  // Sans ce contrôle, tout compte pouvait lister les sessions d'un autre
  // utilisateur via /users/<autre_id>/sessions (IDOR). Cf. PLAN_AMELIORATIONS §0.1.
  if (!isAdmin && requester?.userId !== id) {
    return res
      .status(403)
      .json(
        new ForbiddenException(
          "You can only access your own sessions",
          "user.sessions.forbidden"
        )
      );
  }

  try {
    // Let's find out the user
    const user = await User.findByPk(id);

    if (!user) {
      return res
        .status(404)
        .json(new BadRequestException("User not found !", "user.not.found"));
    }

    const whereClause: any = {};

    if (isAdmin) {
      // L'admin voit tout ; filtre facultatif par capteur.
      if (idSensor) {
        whereClause.idSensor = idSensor;
      }
    } else {
      // Sinon on restreint aux capteurs auxquels l'utilisateur a accès
      // (accès direct ∪ zones/teams).
      const accessibleSensorIds = await getAccessibleSensorIds(
        requester.userId
      );
      if (idSensor) {
        if (!accessibleSensorIds.includes(idSensor)) {
          return res
            .status(403)
            .json(
              new ForbiddenException(
                "You do not have access to this sensor",
                "sensor.access.forbidden"
              )
            );
        }
        whereClause.idSensor = idSensor;
      } else {
        whereClause.idSensor = { [Op.in]: accessibleSensorIds };
      }
    }

    // Bornes alignées sur les autres routes paginées (getAllSessions,
    // getSensor…). Sans elles, `?limit=abc` injectait un NaN dans la clause
    // LIMIT — erreur SQL renvoyée en 500 — et `?limit=1e9` ne plafonnait rien.
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit), 10) || 50)
    );
    const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);

    const { count, rows } = await Session.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ total: count, sessions: rows });
  } catch (error) {
    console.error("Error fetching session:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const payload = jwt.verify(token, envs.REFRESH_TOKEN_SECRET) as {
          userId: string;
        };
        await User.increment("refreshTokenVersion", {
          where: { id: payload.userId },
        });
      } catch {
        // Token invalide ou expiré — on efface quand même le cookie
      }
    }
  } catch {
    // Ignore
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return res.status(200).json({ message: "Logged out successfully" });
};

const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res
        .status(401)
        .json(
          new UnauthorizedException(
            "No refresh token provided !",
            "auth.token.not.found"
          )
        );
    }
    const secret = envs.REFRESH_TOKEN_SECRET;
    const payload = jwt.verify(token, secret) as UserPayload & {
      refreshTokenVersion?: number;
    };

    // Vérifier la version en DB
    const dbUser = await User.findByPk(payload.userId);
    if (!dbUser) {
      return res
        .status(401)
        .json(
          new UnauthorizedException("User not found", "auth.token.invalid")
        );
    }
    // Rejeter aussi les refresh tokens sans version (émis avant la migration
    // refreshTokenVersion) : sinon le logout (qui incrémente la version) ne
    // pourrait pas les révoquer avant leur expiration. -> re-login forcé.
    if (
      typeof payload.refreshTokenVersion !== "number" ||
      dbUser.refreshTokenVersion !== payload.refreshTokenVersion
    ) {
      return res
        .status(401)
        .json(new UnauthorizedException("Token révoqué", "auth.token.revoked"));
    }

    // Le rôle est relu en BASE, pas repris du token : sinon une rétrogradation
    // (admin -> regular) n'était jamais appliquée, l'ancien rôle se réémettant
    // à chaque refresh pendant les 7 jours de validité du refresh token.
    const currentRole = dbUser.role;
    const newToken = jwt.sign(
      { userId: payload.userId, role: currentRole },
      envs.JWT_SECRET,
      {
        expiresIn: envs.JWT_EXPIRATION as any,
      }
    );
    const newRefreshToken = jwt.sign(
      {
        userId: payload.userId,
        role: currentRole,
        refreshTokenVersion: dbUser.refreshTokenVersion,
      },
      envs.REFRESH_TOKEN_SECRET,
      {
        expiresIn: envs.REFRESH_TOKEN_EXPIRATION as any,
      }
    );
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Même source de vérité qu'au login : l'exp réel du token (cf. §0.6).
    const decodedNew = jwt.decode(newToken) as { exp?: number } | null;
    return res.status(200).json({
      token: newToken,
      expiresAt: decodedNew?.exp
        ? decodedNew.exp * 1000
        : Date.now() + 15 * 60 * 1000,
    });
  } catch (error) {
    return res
      .status(401)
      .json(
        new UnauthorizedException(
          "Invalid or expired refresh token !",
          "auth.token.invalid"
        )
      );
  }
};

export {
  signup,
  login,
  updateUserInformation,
  updateRole,
  haveRightsToAcessToAdminPanel,
  getAllRoleWithWorseRole,
  getUserSessions,
  generateUserResponse,
  refresh,
  logout,
};
