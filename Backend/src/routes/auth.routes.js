const express = require("express");
const authController = require("../controllers/auth.controller");
const { requireFields } = require("../middleware/validate");

const router = express.Router();

// POST /api/auth/register
router.post(
  "/register",
  requireFields(["phone", "pin"]),
  authController.register,
);

// POST /api/auth/login
router.post("/login", requireFields(["phone", "pin"]), authController.login);

module.exports = router;
