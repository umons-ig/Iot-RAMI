// Suppress console output during tests to keep output clean.
// Must run after the test framework is installed so jest.spyOn is available.
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});
