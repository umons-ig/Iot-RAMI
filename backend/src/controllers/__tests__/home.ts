import superTest from "supertest";
import app from "@/app";

const baseUri = "/api/v1/";

describe("Home controller", () => {
  describe("GET /", () => {
    test("should return 200 OK", async () => {
      const response = await superTest(app).get(baseUri);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Hello World" });
    });
  });
});
