const express = require("express");
const voiceController = require("../controllers/voice.controller");
const auth = require("../middleware/auth");
const { requireFields } = require("../middleware/validate");

const router = express.Router();

router.use(auth);
router.post(
  "/command",
  requireFields(["command"]),
  voiceController.processVoiceCommand,
);

module.exports = router;
