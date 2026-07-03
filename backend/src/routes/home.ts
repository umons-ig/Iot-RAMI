import express from "express";
import { getHome } from "@controllers/home";

const router = express.Router();

router.route("/").get(getHome);

export { router as homeRoutes };
