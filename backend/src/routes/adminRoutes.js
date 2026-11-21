const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middleware/uploadMiddleware');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const employeeImportUpload = require('../middleware/employeeImportUpload');
const Roles = require('../constants/roles');

// Route to download employee excel upload template
router.get('/download-template', verifyToken, verifyRole([Roles.ADMIN]), adminController.downloadTemplate);

// Route to fetch all employees list for the List Employees page
router.get('/employees', verifyToken, verifyRole([Roles.ADMIN]), adminController.getAllEmployees);

// Route to fetch dropdown options for Add Employee form
router.get('/dropdown-data', verifyToken, verifyRole([Roles.ADMIN]), adminController.getDropdownData);

// Route to create a single employee manually
router.post('/employees', verifyToken, verifyRole([Roles.ADMIN]), adminController.createEmployee);

// Route to bulk import/update employees from HR's Excel export (Admin only).
// verifyRole checks the lowercase `role` claim set by authController.login.
router.post('/employees/import', verifyToken, verifyRole([Roles.ADMIN]), employeeImportUpload, adminController.importEmployees);

// Activate All Users (Admin only): preview, then activate every inactive user
// and email login details to those who have never logged in.
router.get('/employees/activation-summary', verifyToken, verifyRole([Roles.ADMIN]), adminController.getActivationSummary);
router.post('/employees/activate-all', verifyToken, verifyRole([Roles.ADMIN]), adminController.activateAllUsers);

// Activate one inactive user; never-logged-in users get the login email (Admin only)
router.post('/employees/:userId/activate', verifyToken, verifyRole([Roles.ADMIN]), adminController.activateUser);

router.put('/employees/:userId', verifyToken, verifyRole([Roles.ADMIN]), adminController.updateEmployee);

// New temporary password + welcome email (Admin only)
router.post('/employees/:userId/resend-credentials', verifyToken, verifyRole([Roles.ADMIN]), adminController.resendCredentials);

// Sent / failed counts for a bulk upload's welcome emails (Admin only)
router.get('/welcome-mail-batches/:batchId', verifyToken, verifyRole([Roles.ADMIN]), adminController.getWelcomeMailBatch);
router.delete('/employees/:userId', verifyToken, verifyRole([Roles.ADMIN]), adminController.deleteEmployee);

// Route to upload and process employees via Excel spreadsheet
router.post('/upload-employees', verifyToken, verifyRole([Roles.ADMIN]), upload.single('file'), adminController.uploadEmployeesExcel);

module.exports = router;
