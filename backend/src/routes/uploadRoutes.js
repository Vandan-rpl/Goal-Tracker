const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const uploadController = require("../controllers/uploadController");
const authMiddleware = require("../middleware/authMiddleware"); // Adjust name to your JWT middleware file

// Storage layout to save temporary excel sheet files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Enforce simple .xlsx extension check guardrails
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  if (ext !== ".xlsx") {
    return cb(new Error("Only Excel files (.xlsx) are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// Define route matching Requirement 5 specification
router.post("/upload", authMiddleware, upload.single("file"), uploadController.handleBulkUpload);

module.exports = router;