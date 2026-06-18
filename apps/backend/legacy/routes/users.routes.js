const express = require("express");
const usersController = require("../controllers/users.controller");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);
router.get("/profile", usersController.getProfile);
router.put("/profile", usersController.updateProfile);
router.get("/language", usersController.getLanguage);
router.put("/language", usersController.updateLanguage);
router.put("/pin", usersController.updatePin);
router.get("/security", usersController.getSecurity);
router.get("/notifications", usersController.getNotifications);
router.get("/balance", usersController.getBalance);
router.post("/balance", usersController.updateBalance);

module.exports = router;
