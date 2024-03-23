const express = require("express");
const { check } = require("express-validator");

const usersControllers = require("../controllers/users-controllers");
const fileUpload = require("../middleware/file-upload")

const router = express.Router();

//! GET Request: for all the users
router.get("/", usersControllers.getUsers);

//!POST Request: for Signup
router.post(
  "/signup",
  fileUpload.single('image'),
  [
    check("name").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  usersControllers.signup
);

//!POST Request: for Login
router.post("/login", usersControllers.login);

module.exports = router;
