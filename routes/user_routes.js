import express from "express";
import { checkUser, getCurrent, setUserRole } from "../controllers/user_controller.js";

const user_router = express.Router();

user_router.post("/check-user", checkUser);
user_router.post("/roles", setUserRole)
user_router.get("/current", getCurrent)


export default user_router;
