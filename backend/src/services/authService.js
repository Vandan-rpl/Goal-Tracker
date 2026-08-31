const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;
const { DEFAULT_PASSWORD } = require("../constants/constants");
const {
  getUserByEmployeeCode,
  getUserByUsername,
  getUserByEmail,
  getUserByLogin,
  createUser,
  getUserById,       // Added helper method configuration
  changePassword: updatePasswordInDb     // Added helper method configuration
} = require("../models/authModel");

const {
  validateRegister,
  validateLogin,
} = require("../validations/authValidation");

const { generateToken } = require("../utils/jwt");

/**
 * Register New User
 * Used by both Single User Creation and Excel Bulk Upload systems
 */
const registerUser = async (userData) => {
  try {
    // -------------------------------
    // Validate Request
    // -------------------------------
    const validation = validateRegister(userData);

    if (!validation.isValid) {
      return {
        success: false,
        message: "Validation failed.",
        errors: validation.errors,
      };
    }

    // -------------------------------
    // Check Duplicate Employee Code
    // -------------------------------
    const employeeExists = await getUserByEmployeeCode(
      userData.EmployeeCode
    );

    if (employeeExists) {
      return {
        success: false,
        message: "Employee Code already exists.",
        errors: ["Employee Code already exists."],
      };
    }

    // -------------------------------
    // Check Duplicate Username
    // -------------------------------
    const usernameExists = await getUserByUsername(
      userData.Username
    );

    if (usernameExists) {
      return {
        success: false,
        message: "Username already exists.",
        errors: ["Username already exists."],
      };
    }

    // -------------------------------
    // Check Duplicate Email
    // -------------------------------
    const emailExists = await getUserByEmail(userData.Email);

    if (emailExists) {
      return {
        success: false,
        message: "Email already exists.",
        errors: ["Email already exists."],
      };
    }
    
    // If password parameter is omitted or blank, fall back to default password
    const plainPassword =
      userData.PasswordHash && userData.PasswordHash.trim() !== ""
        ? userData.PasswordHash
        : DEFAULT_PASSWORD;

    // Hash selected password string
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    // Replace plaintext field parameters with hashed string
    userData.PasswordHash = hashedPassword;
    
    // Explicitly set database flag default to 0 for tracking first-login status
    userData.IsPasswordChanged = 0;

    console.log("========== REGISTER REQUEST ==========");
    console.log(userData);
    console.log("======================================");

    // -------------------------------
    // Create User Profile Row
    // -------------------------------
    const createdUser = await createUser(userData);

    return {
      success: true,
      message: "User registered successfully.",
      data: {
        UserID: createdUser.UserID,
      },
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Login User
 * Authenticates credentials and returns forcePasswordChange conditional flags
 */
const loginUser = async (loginData) => {
  try {
    // -------------------------------
    // Validate Request
    // -------------------------------
    const validation = validateLogin(loginData);

    if (!validation.isValid) {
      return {
        success: false,
        message: "Validation failed.",
        errors: validation.errors,
      };
    }

    // -------------------------------
    // Find User
    // -------------------------------
    const user = await getUserByLogin(loginData.LoginID);

    if (!user) {
      return {
        success: false,
        message: "Invalid username/email or password.",
        errors: ["Invalid credentials."],
      };
    }

    // -------------------------------
    // Check User Active Status
    // -------------------------------
    if (user.hasOwnProperty("IsActive") && !user.IsActive) {
      return {
        success: false,
        message: "Your account has been deactivated.",
        errors: ["Inactive account."],
      };
    }

    // -------------------------------
    // Compare Password
    // -------------------------------
    const passwordMatched = await bcrypt.compare(
      loginData.Password,
      user.PasswordHash
    );

    if (!passwordMatched) {
      return {
        success: false,
        message: "Invalid username/email or password.",
        errors: ["Invalid credentials."],
      };
    }

    // -------------------------------
    // Generate JWT
    // -------------------------------
    const token = generateToken({
      UserID: user.UserID,
      EmployeeCode: user.EmployeeCode,
      Username: user.Username,
      Role: user.Role,
    });

    // -------------------------------
    // Check First Login Flag (true if status value equals 0 or false)
    // -------------------------------
    const forcePasswordChange = user.IsPasswordChanged === 0 || user.IsPasswordChanged === false || !user.IsPasswordChanged;

    // Remove sensitive information from return payload
    delete user.PasswordHash;

    return {
      success: true,
      message: "Login successful.",
      data: {
        token,
        user,
        forcePasswordChange,
      },
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Change Password
 * Verifies ancient hash parameters and commits updated password hashes
 */
const changeUserPassword = async (userId, passwordData) => {
  try {
    const user = await getUserById(userId);

    if (!user) {
      return { success: false, message: "User not found." };
    }

    const oldPasswordMatched = await bcrypt.compare(
      passwordData.oldPassword,
      user.PasswordHash
    );

    if (!oldPasswordMatched) {
      return { success: false, message: "Old password is incorrect." };
    }

    const newPasswordHash = await bcrypt.hash(passwordData.newPassword, SALT_ROUNDS);

    // હવે અહીં નવું નામ વાપરો
    await updatePasswordInDb({
      UserID: user.UserID,
      PasswordHash: newPasswordHash,
      IsPasswordChanged: 1, 
    });

    return {
      success: true,
      message: "Password changed successfully.",
    };
  } catch (error) {
    console.error("Error in changeUserPassword:", error);
    throw error;
  }
};

module.exports = {
  registerUser,
  loginUser,
  changeUserPassword,
};