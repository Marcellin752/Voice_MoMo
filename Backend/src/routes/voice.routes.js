const express = require("express");
const voiceController = require("../controllers/voice.controller");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);
router.post("/command", voiceController.processVoiceCommand);

module.exports = router;
