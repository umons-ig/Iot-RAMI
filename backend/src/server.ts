// Polyfill for Node.js >= 22 (SlowBuffer removed)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const buffer = require("buffer");
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = buffer.Buffer;
}

import app from "@/app";
import http from "http";
import SocketService from "@/service/socketService";

const normalizePort = (val: string) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
};
const port = normalizePort(process.env.NODE_PORT_IN || "3000");
if ("set" in app) {
  app.set("port", port);
}

const errorHandler = (error: { syscall: string; code: any }) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const address = server.address();
  const bind =
    typeof address === "string" ? "pipe " + address : "port: " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const server = http.createServer(app);
server.timeout = 1000 * 60 * 10; // 10 minutes
const socketService = new SocketService(server);
socketService.initialize();
socketService.startKafkaConsumer();
server.on("error", errorHandler);
server.on("listening", () => {
  const address = server.address();
  const bind = typeof address === "string" ? "pipe " + address : "port " + port;
  console.log("Listening on " + bind);
});

server.listen(port);

const shutdown = async () => {
  console.log("Arrêt du serveur...");
  server.close(async () => {
    await socketService.close();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
