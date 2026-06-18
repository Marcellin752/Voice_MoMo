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

// POST /api/auth/send-otp
router.post(
  "/send-otp",
  requireFields(["phone"]),
  authController.sendOtp
);

// POST /api/auth/verify-otp
router.post(
  "/verify-otp",
  requireFields(["phone", "code"]),
  authController.verifyOtp
);

module.exports = router;

