const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middleware/uploadMiddleware');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const employeeImportUpload = require('../middleware/employeeImportUpload');
const Roles = require('../constants/roles');

// Route to download employee excel upload template
router.get('/download-template', verifyToken, adminController.downloadTemplate);

// Route to fetch all employees list for the List Employees page
router.get('/employees', verifyToken, adminController.getAllEmployees);

// Route to fetch dropdown options for Add Employee form
router.get('/dropdown-data', verifyToken, adminController.getDropdownData);

// Route to create a single employee manually
router.post('/employees', verifyToken, adminController.createEmployee);

// Route to bulk import/update employees from HR's Excel export (Admin only).
// verifyRole checks the lowercase `role` claim set by authController.login.
router.post('/employees/import', verifyToken, verifyRole([Roles.ADMIN]), employeeImportUpload, adminController.importEmployees);

router.put('/employees/:userId', verifyToken, adminController.updateEmployee);
router.delete('/employees/:userId', verifyToken, adminController.deleteEmployee);

// Route to upload and process employees via Excel spreadsheet
router.post('/upload-employees', verifyToken, upload.single('file'), adminController.uploadEmployeesExcel);

module.exports = router;
