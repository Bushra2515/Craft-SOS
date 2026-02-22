const express = require("express");
const protect = require("../Middleware/authMiddleware");
const {
  getChallenges,
  toggleJoin,
} = require("../controllers/challengeController");

const router = express.Router();

router.get("/", protect, getChallenges);
router.patch("/:id/join", protect, toggleJoin);

module.exports = router;
