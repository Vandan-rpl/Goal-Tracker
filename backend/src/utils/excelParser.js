const XLSX = require("xlsx");
const fs = require("fs");

/**
 * =====================================================
 * Parse Excel File
 * Reads first worksheet and converts it to JSON
 * =====================================================
 *
 * @param {string} filePath
 * @returns {Array}
 */
const parseExcelFile = (filePath) => {
  try {
    // Read Excel workbook
    const workbook = XLSX.readFile(filePath);

    // Get first sheet name
    const sheetName = workbook.SheetNames[0];

    // Get worksheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert worksheet to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      defval: "", // Empty cells become ""
      raw: false,
    });

    // Remove completely blank rows
    const cleanedData = data.filter((row) =>
      Object.values(row).some(
        (value) => String(value).trim() !== ""
      )
    );

    // Trim whitespace from all values
    const finalData = cleanedData.map((row) => {
      const cleanedRow = {};

      Object.keys(row).forEach((key) => {
        cleanedRow[key.trim()] =
          typeof row[key] === "string"
            ? row[key].trim()
            : row[key];
      });

      return cleanedRow;
    });

    return finalData;
  } finally {
    // Always delete uploaded file after parsing
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

module.exports = {
  parseExcelFile,
};