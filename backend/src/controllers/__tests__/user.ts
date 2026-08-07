// Model(s) import
import db from "@db/index";
const DB: any = db;
const { User } = DB;
// --- End of model(s) import
import bcrypt from "bcrypt";
import superTest from "supertest";
import app from "@/app";
import jwt from "jsonwebtoken";
import { envs } from "@utils/env";
import { generateUserResponse } from "@/controllers/user";
import { Role, Sex, User as UserType } from "#/user";

const baseUri = "/api/v1/users";
const authBaseUri = "/api/v1/auth";

jest.mock("@db/index", () => {
  // Due to the establishment of associations with RAMI1, the models are now imported from the db
  return {
    User: {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      increment: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
    },
  };
});

jest.mock("bcrypt", () => {
  return {
    hash: jest.fn(),
  };
});

jest.mock("jsonwebtoken", () => {
  return {
    verify: jest.fn().mockImplementation(() => {
      return {
        id: "id-1",
        role: "regular",
      };
    }),
    decode: jest.fn().mockImplementation(() => {
      return {
        id: "id-1",
        role: "regular",
      };
    }),
    sign: jest.fn(),
  };
});

interface UserTmp {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex | string;
  email: string;
  password: string;
  role: Role | string;
}

const user: UserTmp = {
  id: "bc9d5577-c636-402c-a682-dc533f31dfce",
  firstName: "test",
  lastName: "test",
  dateOfBirth: "2000-01-01",
  sex: Sex.MALE,
  email: "test@test.com",
  password: "hashedPassword",
  role: Role.REGULAR,
};

const userBody = {
  id: "c9ff1366-8bea-4782-88d2-b00790c7382a",
  firstName: "test",
  lastName: "test",
  dateOfBirth: "2000-01-01",
  sex: "male",
  email: "test@test.com",
  password: "hasedPassword",
  role: Role.REGULAR,
};

const mockUserOfUserType: UserType = {
  id: "user-id",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: new Date("2000-01-01"),
  password: "hasedPasswordPassword",
  sex: Sex.MALE,
  role: Role.REGULAR,
};

const token = { token: "token" };

describe("generateUserResponse", () => {
  const mockToken = "existing-token";
  const mockRes = { cookie: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return user response with provided token", () => {
    const response = generateUserResponse(
      mockUserOfUserType,
      mockRes,
      mockToken
    );

    expect(response).toEqual({
      id: mockUserOfUserType.id,
      email: mockUserOfUserType.email,
      firstName: mockUserOfUserType.firstName,
      lastName: mockUserOfUserType.lastName,
      dateOfBirth: mockUserOfUserType.dateOfBirth,
      sex: mockUserOfUserType.sex,
      role: mockUserOfUserType.role,
      expiresAt: expect.any(Number),
      token: mockToken,
    });

    expect(response.expiresAt).toBeGreaterThan(Date.now());
  });

  test("should generate and return new token if not provided", () => {
    (jwt.sign as jest.Mock).mockReturnValue("new-token");

    const response = generateUserResponse(mockUserOfUserType, mockRes);

    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: mockUserOfUserType.id, role: mockUserOfUserType.role },
      envs.JWT_SECRET,
      { expiresIn: envs.JWT_EXPIRATION }
    );

    expect(response).toEqual({
      id: mockUserOfUserType.id,
      email: mockUserOfUserType.email,
      firstName: mockUserOfUserType.firstName,
      lastName: mockUserOfUserType.lastName,
      dateOfBirth: mockUserOfUserType.dateOfBirth,
      sex: mockUserOfUserType.sex,
      role: mockUserOfUserType.role,
      expiresAt: expect.any(Number),
      token: "new-token",
    });

    expect(response.expiresAt).toBeGreaterThan(Date.now());
  });

  test("should set refresh token cookie when no token provided", () => {
    (jwt.sign as jest.Mock).mockReturnValue("new-token");

    generateUserResponse(mockUserOfUserType, mockRes);

    expect(mockRes.cookie).toHaveBeenCalledWith(
      "refreshToken",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "strict" })
    );
  });

  test("should not set cookie when token is provided", () => {
    generateUserResponse(mockUserOfUserType, mockRes, mockToken);
    expect(mockRes.cookie).not.toHaveBeenCalled();
  });

  test("should derive expiresAt from the token's exp claim (single source of truth)", () => {
    // L'expiration provient désormais du claim `exp` du JWT (en secondes),
    // plus d'une constante codée en dur. Cf. PLAN_AMELIORATIONS §0.6.
    const expSeconds = Math.floor(Date.now() / 1000) + 15 * 60;
    (jwt.decode as jest.Mock).mockReturnValueOnce({ exp: expSeconds });

    const response = generateUserResponse(
      mockUserOfUserType,
      mockRes,
      mockToken
    );

    expect(response.expiresAt).toBe(expSeconds * 1000);
  });
});

describe("User controller", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("/signup", () => {
    test("should signup", async () => {
      const findOne = jest.fn();
      findOne.mockReturnValueOnce(null);

      const bcryptHash = jest.fn();
      bcryptHash.mockReturnValueOnce("hashedPassword");

      const create = jest.fn();
      create.mockReturnValueOnce(mockUserOfUserType);

      User.findOne = findOne;
      bcrypt.hash = bcryptHash;
      User.create = create;

      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(mockUserOfUserType);

      const expectedResponse = generateUserResponse(mockUserOfUserType, {
        cookie: jest.fn(),
      } as any);

      expect(response.body).toEqual({
        id: expectedResponse.id,
        firstName: expectedResponse.firstName,
        lastName: expectedResponse.lastName,
        dateOfBirth: expectedResponse.dateOfBirth.toISOString(),
        email: expectedResponse.email,
        sex: expectedResponse.sex,
        role: expectedResponse.role,
        expiresAt: expect.any(Number),
        token: expectedResponse.token,
      });
    });
    test("should not signup with invalid body", async () => {
      const response = await superTest(app).post(`${baseUri}/signup`).send({});

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid body !");
      expect(response.body.codeError).toBe("user.body.invalid");
    });
    test("should not signup with empty body", async () => {
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send({ email: "", password: "" });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid body !");
      expect(response.body.codeError).toBe("user.body.invalid");
    });
    test("should not signup with first name too long", async () => {
      const userTest = { ...user };
      userTest.firstName = "1234".repeat(100);
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("First Name too long !");
      expect(response.body.codeError).toBe("user.first.name.too.long");
    });
    test("should not signup with first name too short", async () => {
      const userTest = { ...user };
      userTest.firstName = "a";
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("First Name too short !");
      expect(response.body.codeError).toBe("user.first.name.too.short");
    });
    test("should not signup with last name too long", async () => {
      const userTest = { ...user };
      userTest.lastName = "1234".repeat(100);
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Last Name too long !");
      expect(response.body.codeError).toBe("user.last.name.too.long");
    });
    test("should not signup with last name too short", async () => {
      const userTest = { ...user };
      userTest.lastName = "a";
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Last Name too short !");
      expect(response.body.codeError).toBe("user.last.name.too.short");
    });
    test("should not signup with invalid date of birth", async () => {
      const userTest = { ...user };
      userTest.dateOfBirth = "dateOfBirth";
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid date format!");
      expect(response.body.codeError).toBe("user.date.of.birth.not.valid");
    });
    test("should not signup with invalid sex", async () => {
      const userTest = { ...user };
      userTest.sex = "a";
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("User sex is invalid!");
      expect(response.body.codeError).toBe("user.sex.invalid");
    });
    test("should not signup with password too short", async () => {
      const userTest = { ...user };
      userTest.password = "1234";
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Password too short !");
      expect(response.body.codeError).toBe("user.password.too.short");
    });
    test("should not signup with password too long", async () => {
      const userTest = { ...user };
      userTest.password = "1234".repeat(100);
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Password too long !");
      expect(response.body.codeError).toBe("user.password.too.long");
    });
    test("should not signup with invalid email", async () => {
      const userTest = { ...user };
      userTest.email = "test.com";
      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid email !");
      expect(response.body.codeError).toBe("user.email.not.valid");
    });
    test("should not signup with email already used", async () => {
      const findOne = jest.fn();
      findOne.mockReturnValueOnce(user);
      User.findOne = findOne;

      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(user);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Email already used !");
      expect(response.body.codeError).toBe("user.email.already.used");
    });
    test("should not signup with error", async () => {
      const findOne = jest.fn();
      findOne.mockReturnValueOnce(null);

      const bcryptHash = jest.fn();
      bcryptHash.mockReturnValueOnce("hashedPassword");

      const create = jest.fn();
      create.mockRejectedValueOnce(new Error("Error"));

      User.findOne = findOne;
      bcrypt.hash = bcryptHash;
      User.create = create;

      const response = await superTest(app)
        .post(`${baseUri}/signup`)
        .send(user);

      expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe("Server error !");
      expect(response.body.codeError).toBe("server.error");
    });
  });
  describe("/login", () => {
    test("should login", async () => {
      const findOne = jest.fn();
      const userTest = { ...mockUserOfUserType };
      findOne.mockReturnValueOnce({ dataValues: userTest });

      const bcryptCompare = jest.fn();
      bcryptCompare.mockImplementationOnce(() => true);
      const sign = jest.fn();
      sign.mockReturnValueOnce(token.token);

      jest.spyOn(Date, "now").mockReturnValueOnce(1000);

      User.findOne = findOne;
      bcrypt.compare = bcryptCompare;
      jwt.sign = sign;

      const response = await superTest(app).post(`${baseUri}/login`).send({
        email: mockUserOfUserType.email,
        password: "password", // Original password, not hashed
      });

      const expectedResponse = generateUserResponse(
        userTest,
        { cookie: jest.fn() } as any,
        token.token
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        expiresAt: expect.any(Number),
        token: expectedResponse.token,
      });
    });
    test("should not login with invalid body", async () => {
      const response = await superTest(app).post(`${baseUri}/login`).send({});

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid credentials !");
      expect(response.body.codeError).toBe("user.credentials.invalid");
    });
    test("should not login with empty body", async () => {
      const response = await superTest(app)
        .post(`${baseUri}/login`)
        .send({ email: "", password: "" });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid credentials !");
      expect(response.body.codeError).toBe("user.credentials.invalid");
    });
    test("should not login with invalid email", async () => {
      const userTest = { ...user };
      userTest.email = "test.com";
      const response = await superTest(app)
        .post(`${baseUri}/login`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid email or password !");
      expect(response.body.codeError).toBe("user.credentials.invalid");
    });
    test("should not login with invalid password", async () => {
      const findOne = jest.fn();
      const userTest = { ...user };
      findOne.mockReturnValueOnce({ dataValues: userTest });

      const bcryptCompare = jest.fn();
      bcryptCompare.mockImplementationOnce(() => false);

      User.findOne = findOne;
      bcrypt.compare = bcryptCompare;

      const response = await superTest(app)
        .post(`${baseUri}/login`)
        .send(userBody);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid email or password !");
      expect(response.body.codeError).toBe("user.credentials.invalid");
    });
    test("should not login with findOne error", async () => {
      const findOne = jest.fn();
      findOne.mockRejectedValueOnce(new Error("Error"));

      User.findOne = findOne;

      const response = await superTest(app)
        .post(`${baseUri}/login`)
        .send(userBody);

      expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe("Server error !");
      expect(response.body.codeError).toBe("server.error");
    });
  });
  describe("/update", () => {
    test("should update user information", async () => {
      const userTest = {
        firstName: "Johnathan",
        lastName: "Doe",
        sex: Sex.MALE,
        email: "john.doe@example.com",
        password: "longoldpassword",
        newPassword: "newpassword123",
      };

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce({
        ...mockUserOfUserType,
        firstName: userTest.firstName,
        lastName: userTest.lastName,
        sex: userTest.sex,
        email: userTest.email,
        password: "hashedpassword",
      });

      const findByPkMock = jest.fn();
      findByPkMock.mockReturnValueOnce({
        ...mockUserOfUserType,
        password: "hashedlongoldpassword",
        update: updateMock,
      });

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(null); // Assume no other user with the same email

      // Mocking User.findByPk to return a user object with an update method
      User.findByPk = findByPkMock;
      // Mocking User.findOne to return null for new email check
      User.findOne = findOneMock;
      // Mocking bcrypt.compare to always return true for password comparison
      bcrypt.compare = jest.fn().mockReturnValueOnce(true);
      // Mocking bcrypt.hash to return a hashed password
      bcrypt.hash = jest.fn().mockReturnValueOnce("hashedpassword");
      // Mocking jwt.verify to return a valid payload (this is done in jest.mock block above)
      // Le corps porte un `newPassword` : le contrôleur fait tourner
      // refreshTokenVersion (révocation des sessions ouvertes ailleurs) et
      // réémet donc un jeton au lieu de renvoyer celui de la requête.
      (jwt.sign as jest.Mock).mockReturnValue("token-reemis");

      const response = await superTest(app)
        .put(`${baseUri}/update`)
        .set("Authorization", `Bearer 1234`) // Passing the token in the header
        .send(userTest);

      // Generating the expected response data using generateUserResponse
      const expectedResponse = generateUserResponse(
        {
          ...mockUserOfUserType,
          firstName: userTest.firstName,
          lastName: userTest.lastName,
          sex: userTest.sex,
          email: userTest.email,
          password: "hashedpassword",
        },
        { cookie: jest.fn() } as any,
        "1234"
      );

      // Checking the response status code
      expect(response.statusCode).toBe(200);
      // Checking the response body
      expect(response.body).toEqual({
        id: expectedResponse.id,
        firstName: expectedResponse.firstName,
        lastName: expectedResponse.lastName,
        dateOfBirth: expectedResponse.dateOfBirth.toISOString(),
        email: expectedResponse.email,
        sex: expectedResponse.sex,
        role: expectedResponse.role,
        expiresAt: expect.any(Number),
        token: "token-reemis",
      });
      // Le changement de mot de passe DOIT invalider les sessions existantes :
      // sans rotation de version, un refresh token volé restait valable 7 jours.
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ refreshTokenVersion: 1 })
      );
    });

    test("should NOT rotate refreshTokenVersion when the password is unchanged", async () => {
      const userTest = {
        firstName: "Johnathan",
        lastName: "Doe",
        sex: Sex.MALE,
        email: "john.doe@example.com",
        password: "longoldpassword",
      };

      const updateMock = jest.fn().mockReturnValueOnce({
        ...mockUserOfUserType,
        ...userTest,
      });
      User.findByPk = jest.fn().mockReturnValueOnce({
        ...mockUserOfUserType,
        password: "hashedlongoldpassword",
        update: updateMock,
      });
      User.findOne = jest.fn().mockReturnValueOnce(null);
      bcrypt.compare = jest.fn().mockReturnValueOnce(true);

      const response = await superTest(app)
        .put(`${baseUri}/update`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(200);
      // Une simple mise à jour de profil ne doit déconnecter personne.
      expect(updateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ refreshTokenVersion: expect.anything() })
      );
      expect(response.body.token).toBe("1234");
    });
  });
  describe("/update/role", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(jwt, "verify").mockImplementation(() => {
        return {
          id: "id-1",
          role: Role.ADMIN,
        } as any;
      });
    });
    test("should update role", async () => {
      const userTest = { ...user };

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toEqual("User updated with role regular !");
    });
    test("should not update role with invalid body", async () => {
      const userTest = { ...user };
      userTest.email = "";

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid body !");
      expect(response.body.codeError).toBe("user.body.invalid");
    });
    test("should not update role with empty body", async () => {
      const userTest = { ...user };
      userTest.email = "";

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid body !");
      expect(response.body.codeError).toBe("user.body.invalid");
    });
    test("should not update role with no token", async () => {
      const userTest = { ...user };
      userTest.email = "";

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid token !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
    test("should not update role with invalid email", async () => {
      const userTest = { ...user };
      userTest.email = "test.com";

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid email !");
      expect(response.body.codeError).toBe("user.email.not.valid");
    });
    test("should not update role with invalid role", async () => {
      const userTest = { ...user };
      userTest.role = "test";

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid role !");
      expect(response.body.codeError).toBe("user.role.not.valid");
    });
    test("should not update role with invalid user", async () => {
      const userTest = { ...user };
      userTest.role = Role.ADMIN;

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(null);

      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("User not found !");
      expect(response.body.codeError).toBe("user.not.found");
    });
    test("should not update role if updated Role is better than updater role", async () => {
      // With authAdmin on the route, only admins reach the controller.
      // The controller still enforces that an admin cannot assign a role
      // superior to their own (Role.ADMIN is the ceiling, so this test
      // verifies the middleware now blocks a non-admin caller first).
      const userTest = { ...user };
      userTest.role = Role.ADMIN;

      const updateMock = jest.fn();
      updateMock.mockReturnValueOnce(userTest);

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });

      User.findOne = findOneMock;
      User.update = updateMock;
      jwt.verify = verifyMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      // authAdmin blocks non-admin callers before the controller logic runs
      expect(response.statusCode).toBe(401);
      expect(response.body.codeError).toBe("auth.token.unauthorized");
    });
    test("should return a 401 if there is no payload", async () => {
      const userTest = { ...user };
      userTest.role = Role.ADMIN;

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      const verifyMock = jest.fn();
      // authAdmin calls jwt.verify twice (verifyToken + role check); first
      // call returns a non-admin role so the middleware blocks immediately.
      verifyMock.mockReturnValueOnce({ id: "id-34", role: Role.REGULAR });
      verifyMock.mockReturnValueOnce(null);

      jwt.verify = verifyMock;
      User.findOne = findOneMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(401);
      expect(response.body.codeError).toBe("auth.token.unauthorized");
    });
    test("should return a 500 if update user fail", async () => {
      const userTest = { ...user };
      userTest.role = Role.REGULAR;

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      const updateMock = jest.fn();
      updateMock.mockReturnValue(null);

      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });

      jwt.verify = verifyMock;
      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe("Server error !");
      expect(response.body.codeError).toBe("server.error");
    });
    test("should return a 500 if update user throw an error", async () => {
      const userTest = { ...user };
      userTest.role = Role.REGULAR;

      const findOneMock = jest.fn();
      findOneMock.mockReturnValueOnce(user);

      const updateMock = jest.fn();
      updateMock.mockRejectedValueOnce(new Error("Server error !"));

      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });

      jwt.verify = verifyMock;
      User.findOne = findOneMock;
      User.update = updateMock;

      const response = await superTest(app)
        .put(`${baseUri}/update/role`)
        .set("Authorization", `Bearer 1234`)
        .send(userTest);

      //expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe("Server error !");
      expect(response.body.codeError).toBe("server.error");
    });
    test("should return a 400 if there is no token", async () => {
      const response = await superTest(app).put(`${baseUri}/update/role`);
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid token !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
  });
  describe("/verify/adminPanel", () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jwt.verify = jest.fn().mockImplementation(() => {
        return {
          id: "id-34",
          role: "privileged",
        };
      });
    });
    test("should pass if the token is valid and role is better than regular", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ userId: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;

      const response = await superTest(app)
        .get(`${baseUri}/verify/adminPanel`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe(
        "You have enough rights to access to admin panel !"
      );
    });
    test("should not pass if the token is invalid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockImplementation(() => {
        return null;
      });
      jwt.verify = verifyMock;

      const response = await superTest(app)
        .get(`${baseUri}/verify/adminPanel`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe("Unauthorized !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
    test("should not pass if the role is regular", async () => {
      const decodeMock = jest.fn();
      decodeMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.decode = decodeMock;

      const response = await superTest(app)
        .get(`${baseUri}/verify/adminPanel`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe(
        "You don't have enough rights to access to admin panel !"
      );
      expect(response.body.codeError).toBe("user.role.not.enough.permissions");
    });
    test("should not pass if verify return null", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue(null);
      jwt.verify = verifyMock;

      const response = await superTest(app)
        .get(`${baseUri}/verify/adminPanel`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe("Unauthorized !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
    test("should return a 500 if jwt.verify throw an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockImplementation(() => {
        throw new Error("Server error !");
      });
      jwt.verify = verifyMock;

      const response = await superTest(app)
        .get(`${baseUri}/verify/adminPanel`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe("Server error !");
      expect(response.body.codeError).toBe("server.error");
    });
    test("should return a 400 if no token is provided", async () => {
      const response = await superTest(app).get(`${baseUri}/verify/adminPanel`);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid token !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
  });
  describe("/all", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    test("should not return all users if the user role is regular", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const response = await superTest(app)
        .get(`${baseUri}/all`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe(
        "You don't have enough rights to get all users with worse role than you !"
      );
      expect(response.body.codeError).toBe("user.role.not.enough.permissions");
    });
    test("should not return all users if the user role is privileged", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.PRIVILEGED });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const userWorseThanInstructor = { ...user };

      const findAllMock = jest.fn();
      findAllMock.mockReturnValueOnce(userWorseThanInstructor);
      User.findAll = findAllMock;

      const response = await superTest(app)
        .get(`${baseUri}/all`)
        .set("Authorization", `Bearer 1234`);

      //expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(userWorseThanInstructor);
    });
    test("should return all user without other admin if the user role is admin", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const userPrivileged = { ...user };
      userPrivileged.role = Role.PRIVILEGED;
      const userWorseThanAdmin = { ...user, ...userPrivileged };

      const findAllMock = jest.fn();
      findAllMock.mockReturnValueOnce(userWorseThanAdmin);
      User.findAll = findAllMock;

      const response = await superTest(app)
        .get(`${baseUri}/all`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(userWorseThanAdmin);
    });
    test("should not return all users if an error occured", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockImplementation(() => {
        throw new Error();
      });
      User.findAll = findAllMock;

      const response = await superTest(app)
        .get(`${baseUri}/all`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe("Server error !");
      expect(response.body.codeError).toBe("server.error");
    });
    test("should not pass if verify return null", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue(null);
      jwt.verify = verifyMock;

      const response = await superTest(app)
        .get(`${baseUri}/all`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe("Unauthorized !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
    test("should return a 404 if jwt.decode throw an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockReturnValueOnce(null);
      User.findAll = findAllMock;

      const response = await superTest(app)
        .get(`${baseUri}/all`)
        .set("Authorization", `Bearer 1234`);

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe("No user found !");
      expect(response.body.codeError).toBe("user.not.found");
    });
    test("should return a 400 if no token is provided", async () => {
      const response = await superTest(app).get(`${baseUri}/all`);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid token !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });
  });

  describe("/auth/refresh", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should return 401 if no refresh token cookie", async () => {
      const response = await superTest(app).post(`${authBaseUri}/refresh`);

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe("No refresh token provided !");
      expect(response.body.codeError).toBe("auth.token.not.found");
    });

    test("should return 401 if refresh token is invalid", async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error("invalid token");
      });

      const response = await superTest(app)
        .post(`${authBaseUri}/refresh`)
        .set("Cookie", "refreshToken=invalid-token");

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe("Invalid or expired refresh token !");
      expect(response.body.codeError).toBe("auth.token.invalid");
    });

    test("should return 200 with new token if refresh token is valid", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: mockUserOfUserType.id,
        role: mockUserOfUserType.role,
        refreshTokenVersion: 0,
      });
      User.findByPk = jest.fn().mockResolvedValue({
        id: mockUserOfUserType.id,
        role: mockUserOfUserType.role,
        refreshTokenVersion: 0,
      });
      (jwt.sign as jest.Mock).mockReturnValue("new-access-token");

      const response = await superTest(app)
        .post(`${authBaseUri}/refresh`)
        .set("Cookie", "refreshToken=valid-refresh-token");

      expect(response.statusCode).toBe(200);
      expect(response.body.token).toBe("new-access-token");
      expect(response.body.expiresAt).toBeGreaterThan(Date.now());
    });

    test("should return 401 if refresh token has no version (pre-migration)", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: mockUserOfUserType.id,
        role: mockUserOfUserType.role,
        // pas de refreshTokenVersion -> token pré-migration, doit être rejeté
      });
      User.findByPk = jest.fn().mockResolvedValue({
        id: mockUserOfUserType.id,
        role: mockUserOfUserType.role,
        refreshTokenVersion: 0,
      });

      const response = await superTest(app)
        .post(`${authBaseUri}/refresh`)
        .set("Cookie", "refreshToken=unversioned-token");

      expect(response.statusCode).toBe(401);
      expect(response.body.codeError).toBe("auth.token.revoked");
    });

    test("should set a new refresh token cookie on success", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: mockUserOfUserType.id,
        role: mockUserOfUserType.role,
        refreshTokenVersion: 0,
      });
      User.findByPk = jest.fn().mockResolvedValue({
        id: mockUserOfUserType.id,
        role: mockUserOfUserType.role,
        refreshTokenVersion: 0,
      });
      (jwt.sign as jest.Mock).mockReturnValue("new-token");

      const response = await superTest(app)
        .post(`${authBaseUri}/refresh`)
        .set("Cookie", "refreshToken=valid-refresh-token");

      expect(response.statusCode).toBe(200);
      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader[0]).toContain("refreshToken");
    });
  });

  describe("/auth/logout", () => {
    test("should return 200 and clear the refresh token cookie", async () => {
      const response = await superTest(app)
        .post(`${authBaseUri}/logout`)
        .set("Cookie", "refreshToken=some-token");

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("Logged out successfully");

      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader[0]).toContain("refreshToken=;");
    });
  });
});
