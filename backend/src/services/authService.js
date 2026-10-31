const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;
const { generateTemporaryPassword } = require("../utils/passwordGenerator");
const {
  getUserByEmployeeCode,
  getUserByUsername,
  getUserByEmail,
  createUser,
  getUserById,       // Added helper method configuration
  changePassword: updatePasswordInDb     // Added helper method configuration
} = require("../models/authModel");

const {
  validateRegister,
} = require("../validations/authValidation");

/**
 * New random temporary password and its hash. The plain password is only for
 * the welcome email: never store, log or return it in an API response.
 */
const issueTemporaryPassword = async () => {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
  return { temporaryPassword, passwordHash };
};

/**
 * Register New User
 * Used by both Single User Creation and Excel Bulk Upload systems.
 *
 * Always gets a fresh temporary password (any PasswordHash passed in is
 * ignored) and DefaultPasswordFlag = 1 / IsPasswordChanged = 0. On success
 * the plain password is returned as `temporaryPassword`, beside `data`, so
 * the caller can send the welcome email; it must not go into a response.
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
    
    const { temporaryPassword, passwordHash } = await issueTemporaryPassword();

    // IsPasswordChanged = 0 makes createUser store DefaultPasswordFlag = 1:
    // the user must change the temporary password on first login.
    const createdUser = await createUser({
      ...userData,
      PasswordHash: passwordHash,
      IsPasswordChanged: 0,
    });

    return {
      success: true,
      message: "User registered successfully.",
      data: {
        UserID: createdUser.UserID,
      },
      temporaryPassword,
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
  issueTemporaryPassword,
  registerUser,
  changeUserPassword,
};