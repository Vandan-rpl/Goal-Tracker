const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload"); // adjust to your multer middleware file name

// Bulk employee upload
router.post("/upload", authMiddleware, upload.single("file"), uploadController.handleBulkUpload);

module.exports = router;