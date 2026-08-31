const xlsx = require("xlsx");
const authService = require("./authService");
const {
  getUserByEmployeeCode,
  getUserByUsername,
  getUserByEmail
} = require("../models/authModel");

/**
 * Parses an Excel sheet and registers users sequentially
 * @param {string} filePath - Absolute path to the temporary uploaded file
 * @returns {Object} Success/failure count and row-wise error details
 */
const processBulkUserUpload = async (filePath) => {
  let inserted = 0;
  let failed = 0;
  const errors = [];

  try {
    // Read the workbook from the temporary file path
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Iterate through rows sequentially to maintain precise error logs per row
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      const rowNumber = i + 2; // Row 1 is the header row in Excel

      // 1. Ignore completely blank rows
      if (!row || Object.keys(row).length === 0 || Object.values(row).every(val => val === null || String(val).trim() === "")) {
        continue;
      }

      try {
        // 2. Validate row fields mapped to Single User Creation requirements
        if (!row.EmployeeCode || String(row.EmployeeCode).trim() === "") throw new Error("EmployeeCode is required.");
        if (!row.Username || String(row.Username).trim() === "") throw new Error("Username is required.");
        if (!row.Email || String(row.Email).trim() === "") throw new Error("Email is required.");
        if (!row.Role || String(row.Role).trim() === "") throw new Error("Role is required.");

        const employeeCodeStr = String(row.EmployeeCode).trim();
        const usernameStr = String(row.Username).trim();
        const emailStr = String(row.Email).trim();

        // 3. Skip duplicates (EmployeeCode, Username, or Email)
        const employeeExists = await getUserByEmployeeCode(employeeCodeStr);
        if (employeeExists) throw new Error("EmployeeCode already exists.");

        const usernameExists = await getUserByUsername(usernameStr);
        if (usernameExists) throw new Error("Username already exists.");

        const emailExists = await getUserByEmail(emailStr);
        if (emailExists) throw new Error("Email already exists.");

        // 4. Construct payload following Single User structure exactly
        const userData = {
          EmployeeCode: employeeCodeStr,
          Username: usernameStr,
          Email: emailStr,
          FirstName: row.FirstName ? String(row.FirstName).trim() : "",
          LastName: row.LastName ? String(row.LastName).trim() : "",
          MobileNo: row.MobileNo ? String(row.MobileNo).trim() : "",
          DepartmentID: row.DepartmentID ? parseInt(row.DepartmentID, 10) : null,
          Designation: row.Designation ? String(row.Designation).trim() : "",
          Grade: row.Grade ? String(row.Grade).trim() : "",
          Post: row.Post ? String(row.Post).trim() : "",
          ReportingManagerID: row.ReportingManagerID ? parseInt(row.ReportingManagerID, 10) : null,
          HODID: row.HODID ? parseInt(row.HODID, 10) : null,
          BusinessHeadID: row.BusinessHeadID ? parseInt(row.BusinessHeadID, 10) : null,
          Role: row.Role ? String(row.Role).trim() : "User",
          PasswordHash: "" // Triggers default password hashing inside registerUser service
        };

        // 5. Reuse the existing registerUser service
        const registrationResult = await authService.registerUser(userData);

        if (registrationResult.success) {
          inserted++;
        } else {
          // Capture inner validation errors returned from registerUser
          const primaryError = registrationResult.errors && registrationResult.errors[0] 
            ? registrationResult.errors[0] 
            : registrationResult.message;
          throw new Error(primaryError);
        }

      } catch (rowError) {
        failed++;
        errors.push({
          row: rowNumber,
          message: rowError.message
        });
      }
    }

    return {
      success: true,
      totalRows: sheetData.length,
      inserted,
      failed,
      errors
    };

  } catch (error) {
    throw error;
  }
};

module.exports = {
  processBulkUserUpload
};