import express from "express";
import { auth } from "@middlewares/auth";
import { refresh, logout } from "@controllers/user";

const router = express.Router();

router.route("/").post(auth, (_req, res) => {
  res.status(201).json({
    message: "Auth route !",
  });
});

router.route("/refresh").post(refresh);
router.route("/logout").post(logout);

export { router as authRoutes };
