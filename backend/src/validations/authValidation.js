/**
 * Authentication Validation
 * -------------------------------------
 * This file validates incoming request data
 * before it reaches the service layer.
 */

/**
 * Validate User Registration Request
 */
const validateRegister = (data) => {
  const errors = [];

  // Employee Code
  if (!data.EmployeeCode || String(data.EmployeeCode).trim() === "") {
    errors.push("Employee Code is required.");
  }

  // Username
  if (!data.Username || String(data.Username).trim() === "") {
    errors.push("Username is required.");
  }

  // Email
  if (!data.Email || String(data.Email).trim() === "") {
    errors.push("Email is required.");
  } else {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(data.Email)) {
      errors.push("Invalid email format.");
    }
  }

  // Department
  if (
    data.DepartmentID === undefined ||
    data.DepartmentID === null ||
    String(data.DepartmentID).trim() === ""
  ) {
    errors.push("Department is required.");
  }

  // Role
  if (!data.Role || String(data.Role).trim() === "") {
    errors.push("Role is required.");
  }

  // Mobile Number (Optional, but checked for 10-digit constraints if provided)
  if (data.MobileNo && String(data.MobileNo).trim() !== "") {
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(String(data.MobileNo).trim())) {
      errors.push("Mobile Number must contain exactly 10 digits.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate Login Request
 */
const validateLogin = (data) => {
  const errors = [];

  if (!data.LoginID || String(data.LoginID).trim() === "") {
    errors.push("Username or Email is required.");
  }

  if (!data.Password || String(data.Password).trim() === "") {
    errors.push("Password is required.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate Change Password Request
 * Enforces Requirements 8 & 10 (Password Strength Checks)
 */
const validateChangePassword = (req, res, next) => {
  const data = req.body;
  const errors = [];

  if (!data.oldPassword || String(data.oldPassword).trim() === "") {
    errors.push("Old password is required.");
  }

  if (!data.newPassword || String(data.newPassword).trim() === "") {
    errors.push("New password is required.");
  } else {
    // Password Strength Verification (Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(data.newPassword)) {
      errors.push(
        "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character."
      );
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors,
    });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
};