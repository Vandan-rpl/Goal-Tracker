const uploadService = require("../services/uploadService");
const fs = require("fs");

/**
 * Handles multipart files containing employee spreadsheet structures
 */
const handleBulkUpload = async (req, res) => {
  try {
    // Ensure file middleware initialized properly
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload an Excel file (.xlsx)." });
    }

    // Hand off processing to service layer
    const result = await uploadService.processBulkUserUpload(req.file.path);

    // Async cleaning cleanup of file on local machine storage
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    return res.status(200).json(result);
  } catch (error) {
    // Ensure temporary storage gets dropped even on critical layout failures
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  handleBulkUpload
};