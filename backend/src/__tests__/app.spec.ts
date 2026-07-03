import app from "@/app";
import superTest from "supertest";

describe("Test the root path", () => {
  test("It should not found url", async () => {
    const response = await superTest(app).get("/notfound");
    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Resource not found");
    expect(response.body.codeError).toBe("resource.not.found");
  });
});
