const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middleware/uploadMiddleware');
const { verifyToken } = require('../middleware/authMiddleware');

// Route to download employee excel upload template
router.get('/download-template', verifyToken, adminController.downloadTemplate);

// Route to fetch all employees list for the List Employees page
router.get('/employees', verifyToken, adminController.getAllEmployees);

// Route to fetch dropdown options for Add Employee form
router.get('/dropdown-data', verifyToken, adminController.getDropdownData);

// Route to create a single employee manually
router.post('/employees', verifyToken, adminController.createEmployee);

router.put('/employees/:userId', verifyToken, adminController.updateEmployee);
router.delete('/employees/:userId', verifyToken, adminController.deleteEmployee);

// Route to upload and process employees via Excel spreadsheet
router.post('/upload-employees', verifyToken, upload.single('file'), adminController.uploadEmployeesExcel);

module.exports = router;
