import app from "@/app";
import superTest from "supertest";
import jwt from "jsonwebtoken";

// On conserve les vraies classes d'erreur (TokenExpiredError/JsonWebTokenError)
// pour que les `instanceof` du middleware fonctionnent ; seul verify est mocké.
jest.mock("jsonwebtoken", () => {
  const actual = jest.requireActual("jsonwebtoken");
  return {
    ...actual,
    verify: jest.fn(),
  };
});

const baseUri = "/api/v1/auth";

describe("Auth middleware", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("It should pass auth", async () => {
    const verifyMock = jest.fn();
    (verifyMock as jest.Mock).mockImplementationOnce(() => {
      return {
        id: 1,
        role: "user",
      };
    });
    jwt.verify = verifyMock;
    const response = await superTest(app)
      .post(baseUri)
      .send({
        name: "test",
        id: 1,
      })
      .set("Authorization", "Bearer 123456789");
    expect(response.statusCode).toBe(201);
  });
  test("It should not pass auth and return 400 (no token)", async () => {
    const response = await superTest(app).post(baseUri).send({
      name: "test",
      id: 1,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Invalid token !");
    expect(response.body.codeError).toBe("auth.token.invalid");
  });
  test("It should not pass auth and return 401 (invalid token)", async () => {
    const verifyMock = jest.fn();
    (verifyMock as jest.Mock).mockImplementationOnce(() => {
      return null;
    });
    jwt.verify = verifyMock;

    const response = await superTest(app)
      .post(baseUri)
      .send({
        name: "test",
        id: 1,
      })
      .set("Authorization", "Bearer 123456789");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Unauthorized !");
    expect(response.body.codeError).toBe("auth.token.invalid");
  });
  test("It should not pass auth and return 401 (malformed token)", async () => {
    const verifyMock = jest.fn();
    (verifyMock as jest.Mock).mockImplementationOnce(() => {
      throw new jwt.JsonWebTokenError("invalid token");
    });
    jwt.verify = verifyMock;

    const response = await superTest(app)
      .post(baseUri)
      .send({
        name: "test",
        id: 1,
      })
      .set("Authorization", "Bearer 123456789");

    // Avant : 500 (cf. §0.5). Un token malformé est une erreur d'auth -> 401.
    expect(response.statusCode).toBe(401);
    expect(response.body.codeError).toBe("auth.token.invalid");
  });

  test("It should not pass auth and return 401 (expired token)", async () => {
    const verifyMock = jest.fn();
    (verifyMock as jest.Mock).mockImplementationOnce(() => {
      throw new jwt.TokenExpiredError("jwt expired", new Date());
    });
    jwt.verify = verifyMock;

    const response = await superTest(app)
      .post(baseUri)
      .send({ name: "test", id: 1 })
      .set("Authorization", "Bearer 123456789");

    expect(response.statusCode).toBe(401);
    expect(response.body.codeError).toBe("auth.token.expired");
  });
});
