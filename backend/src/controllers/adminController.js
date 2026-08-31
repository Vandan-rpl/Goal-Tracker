const { poolPromise, sql } = require('../config/db');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { registerUser } = require('../services/authService');
const { DEFAULT_PASSWORD } = require('../constants/constants');

const REPORTING_HIERARCHY_FIELDS = ['ReportingManagerID', 'HODID', 'BusinessHeadID'];
const ROLE_RANKS = {
    Employee: 1,
    Manager: 2,
    HOD: 3,
    BusinessHead: 4,
};

const hasHierarchyValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const getRoleRank = (role) => {
    if (!role) return null;
    const normalizedRole = String(role).trim();
    return ROLE_RANKS[normalizedRole] ?? null;
};

const validateReportingHierarchyFixed = ({ Role, ReportingManagerID, HODID, BusinessHeadID }) => {
    const role = String(Role ?? '').trim();
    const rank = getRoleRank(role);
    const errors = [];

    if (rank === null) {
        errors.push(`Role: invalid value '${Role}'. Allowed values are Employee, Manager, HOD, BusinessHead.`);
        return { isValid: false, errors };
    }

    if (role === 'BusinessHead') {
        return { isValid: true, errors: [] };
    }

    const suppliedFields = REPORTING_HIERARCHY_FIELDS.filter((field) => {
        const value = { ReportingManagerID, HODID, BusinessHeadID }[field];
        return hasHierarchyValue(value);
    });

    if (suppliedFields.length === 0) {
        errors.push(`At least one of ReportingManagerID, HODID, BusinessHeadID is required for role '${role}'.`);
        return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
};

const validateReportingHierarchyWithDb = async ({ Role, ReportingManagerID, HODID, BusinessHeadID }) => {
    const role = String(Role ?? '').trim();
    const roleRank = getRoleRank(role);
    const errors = [];

    if (roleRank === null) {
        return {
            isValid: false,
            errors: [`Role: invalid value '${Role}'. Allowed values are Employee, Manager, HOD, BusinessHead.`],
        };
    }

    const pool = await poolPromise;

    for (const field of REPORTING_HIERARCHY_FIELDS) {
        const rawValue = { ReportingManagerID, HODID, BusinessHeadID }[field];

        if (!hasHierarchyValue(rawValue)) {
            continue;
        }

        const userId = Number(rawValue);
        if (Number.isNaN(userId)) {
            errors.push(`${field}: selected value '${rawValue}' is not a valid UserID.`);
            continue;
        }

        const request = pool.request();
        request.input('UserID', sql.Int, userId);

        const userResult = await request.query(`
            SELECT TOP 1 UserID, Role, IsActive
            FROM dbo.Users
            WHERE UserID = @UserID
        `);

        const selectedUser = userResult.recordset[0];

        if (!selectedUser) {
            errors.push(`${field}: selected user does not exist.`);
            continue;
        }

        const isActive = selectedUser.IsActive === 1 || selectedUser.IsActive === true || selectedUser.IsActive === '1';
        if (!isActive) {
            errors.push(`${field}: selected user is inactive.`);
            continue;
        }

        const selectedUserRole = String(selectedUser.Role ?? '').trim();
        const selectedUserRoleRank = getRoleRank(selectedUserRole);

        if (selectedUserRoleRank === null) {
            errors.push(`${field}: selected user's Role '${selectedUserRole}' is invalid.`);
            continue;
        }

        if (selectedUserRoleRank <= roleRank) {
            errors.push(`${field}: selected user's Role '${selectedUserRole}' does not outrank '${role}'.`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

// Helper function to slugify names for username/email generation
const slugify = (str) =>
    String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');

/**
 * Get Dropdown Data (Active Employees & Departments) for Add Employee Form
 */
const getDropdownData = async (req, res) => {
    try {
        const pool = await poolPromise;

        const usersResult = await pool.request().query(`
            SELECT UserID, FirstName, LastName, Role, Designation
            FROM dbo.Users
            WHERE IsActive = 1
            ORDER BY FirstName, LastName
        `);

        const deptResult = await pool.request().query(`
            SELECT DepartmentID, DepartmentName
            FROM dbo.Departments
            ORDER BY DepartmentName
        `);

        return res.status(200).json({
            success: true,
            data: {
                employees: usersResult.recordset,
                departments: deptResult.recordset
            }
        });
    } catch (error) {
        console.error('Get Dropdown Data Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while fetching dropdown data.', 
            errors: error.message 
        });
    }
};

/**
 * Get All Employees List for List Employees Page
 */
const getAllEmployees = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
                u.UserID, 
                u.EmployeeCode, 
                u.Username, 
                u.Email, 
                u.FirstName, 
                u.LastName, 
                u.Role, 
                u.IsActive, 
                d.DepartmentName
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d ON u.DepartmentID = d.DepartmentID
            ORDER BY u.CreatedDate DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Get All Employees Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while fetching employees list.', 
            errors: error.message 
        });
    }
};

/**
 * Generate and Download Excel Template with Working Excel Range Dropdowns using ExcelJS
 */
const downloadTemplate = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Fetch active departments, employee names, and roles
        const deptsResult = await pool.request().query('SELECT DepartmentName FROM dbo.Departments ORDER BY DepartmentName');
        const usersResult = await pool.request().query("SELECT (FirstName + ' ' + LastName) AS FullName FROM dbo.Users WHERE IsActive = 1 ORDER BY FirstName");

        const departments = deptsResult.recordset.map(d => d.DepartmentName);
        const employees = usersResult.recordset.map(e => e.FullName);
        const roles = ["Employee", "Manager", "HOD", "CFO", "BusinessHead", "Admin"];

        const workbook = new ExcelJS.Workbook();
        
        // 1. Create a hidden lookup worksheet to store dropdown master lists safely
        const lookupSheet = workbook.addWorksheet('Dropdowns');
        lookupSheet.state = 'hidden';

        departments.forEach((dept, index) => {
            lookupSheet.getCell(`A${index + 1}`).value = dept;
        });
        roles.forEach((role, index) => {
            lookupSheet.getCell(`B${index + 1}`).value = role;
        });
        employees.forEach((emp, index) => {
            lookupSheet.getCell(`C${index + 1}`).value = emp;
        });

        // 2. Create the main Employee Template worksheet
        const worksheet = workbook.addWorksheet('EmployeeTemplate');

        worksheet.columns = [
            { header: 'EmployeeCode', key: 'EmployeeCode', width: 15 },
            { header: 'FirstName', key: 'FirstName', width: 15 },
            { header: 'LastName', key: 'LastName', width: 15 },
            { header: 'Email', key: 'Email', width: 25 },
            { header: 'MobileNo', key: 'MobileNo', width: 15 },
            { header: 'Department', key: 'Department', width: 20 },
            { header: 'Designation', key: 'Designation', width: 20 },
            { header: 'Grade', key: 'Grade', width: 10 },
            { header: 'Post', key: 'Post', width: 15 },
            { header: 'Role', key: 'Role', width: 15 },
            { header: 'ReportingManager', key: 'ReportingManager', width: 25 },
            { header: 'HOD', key: 'HOD', width: 25 },
            { header: 'BusinessHead', key: 'BusinessHead', width: 25 }
        ];

        // Add sample row
        worksheet.addRow({
            EmployeeCode: 'EMP001',
            FirstName: 'John',
            LastName: 'Doe',
            Email: '', 
            MobileNo: '9876543210',
            Department: departments[0] || '',
            Designation: 'Developer',
            Grade: 'L3',
            Post: 'Software Eng',
            Role: 'Employee',
            ReportingManager: '',
            HOD: '',
            BusinessHead: ''
        });

        const maxRow = 200;
        const deptCount = Math.max(departments.length, 1);
        const roleCount = Math.max(roles.length, 1);
        const empCount = Math.max(employees.length, 1);

        for (let i = 2; i <= maxRow; i++) {
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Dropdowns!$A$1:$A$${deptCount}`]
            };

            worksheet.getCell(`J${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Dropdowns!$B$1:$B$${roleCount}`]
            };

            worksheet.getCell(`K${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Dropdowns!$C$1:$C$${empCount}`]
            };

            worksheet.getCell(`L${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Dropdowns!$C$1:$C$${empCount}`]
            };

            worksheet.getCell(`M${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Dropdowns!$C$1:$C$${empCount}`]
            };
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Employee_Upload_Template.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Download Template Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate template.' });
    }
};

/**
 * Create a Single Employee Manually
 */
const createEmployee = async (req, res) => {
    try {
        const {
            EmployeeCode, Username, Email, FirstName, LastName, MobileNo,
            DepartmentID, Designation, Grade, Post,
            ReportingManagerID, HODID, BusinessHeadID, Role
        } = req.body;

        const roleValue = Role || 'Employee';
        const fixedValidation = validateReportingHierarchyFixed({
            Role: roleValue,
            ReportingManagerID,
            HODID,
            BusinessHeadID,
        });

        if (!fixedValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Reporting hierarchy validation failed.',
                errors: fixedValidation.errors,
            });
        }

        const dbValidation = await validateReportingHierarchyWithDb({
            Role: roleValue,
            ReportingManagerID,
            HODID,
            BusinessHeadID,
        });

        if (!dbValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Reporting hierarchy validation failed.',
                errors: dbValidation.errors,
            });
        }

        const firstSlug = slugify(FirstName);
        const lastSlug = slugify(LastName);
        const finalUsername = Username || (firstSlug && lastSlug ? `${firstSlug}.${lastSlug}` : '');
        const finalEmail = Email || (firstSlug && lastSlug ? `${firstSlug}.${lastSlug}@rubamin.com` : '');

        const userData = {
            EmployeeCode: EmployeeCode || null,
            Username: finalUsername,
            Email: finalEmail,
            FirstName: FirstName,
            LastName: LastName,
            MobileNo: MobileNo || null,
            DepartmentID: DepartmentID || null,
            Designation: Designation || null,
            Grade: Grade || null,
            Post: Post || null,
            ReportingManagerID: ReportingManagerID || null,
            HODID: HODID || null,
            BusinessHeadID: BusinessHeadID || null,
            Role: roleValue,
            PasswordHash: DEFAULT_PASSWORD || 'Rubamin@123'
        };

        const result = await registerUser(userData);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                errors: result.errors || []
            });
        }

        return res.status(201).json({
            success: true,
            message: `Employee created successfully. Default password is '${DEFAULT_PASSWORD || 'Rubamin@123'}'.`,
            data: result.data
        });

    } catch (error) {
        console.error('Create Employee Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while creating employee.', 
            errors: error.message 
        });
    }
};

/**
 * Bulk Create Employees via Excel Spreadsheet Upload with Name-to-ID Mapping & Auto Email
 */
const uploadEmployeesExcel = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Please upload an Excel file.'
        });
    }

    const filePath = req.file.path;

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!sheetData || sheetData.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: 'The uploaded Excel sheet is empty.'
            });
        }

        const pool = await poolPromise;

        const deptMapRes = await pool.request().query('SELECT DepartmentID, DepartmentName FROM dbo.Departments');
        const deptMap = {};
        deptMapRes.recordset.forEach(d => {
            deptMap[d.DepartmentName.trim().toLowerCase()] = d.DepartmentID;
        });

        const userMapRes = await pool.request().query("SELECT UserID, (FirstName + ' ' + LastName) AS FullName FROM dbo.Users WHERE IsActive = 1");
        const userMap = {};
        userMapRes.recordset.forEach(u => {
            userMap[u.FullName.trim().toLowerCase()] = u.UserID;
        });

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < sheetData.length; i++) {
            const row = sheetData[i];

            const FirstName = row.FirstName;
            const LastName = row.LastName;

            if (!FirstName) {
                errorCount++;
                errors.push(`Row ${i + 2}: Missing mandatory FirstName.`);
                continue;
            }

            let departmentID = null;
            if (row.Department) {
                const deptKey = String(row.Department).trim().toLowerCase();
                departmentID = deptMap[deptKey] || (Number(row.Department) ? Number(row.Department) : null);
            }

            let reportingManagerID = null;
            if (row.ReportingManager) {
                const mgrKey = String(row.ReportingManager).trim().toLowerCase();
                reportingManagerID = userMap[mgrKey] || (Number(row.ReportingManager) ? Number(row.ReportingManager) : null);
            }

            let hodID = null;
            if (row.HOD) {
                const hodKey = String(row.HOD).trim().toLowerCase();
                hodID = userMap[hodKey] || (Number(row.HOD) ? Number(row.HOD) : null);
            }

            let businessHeadID = null;
            if (row.BusinessHead) {
                const bhKey = String(row.BusinessHead).trim().toLowerCase();
                businessHeadID = userMap[bhKey] || (Number(row.BusinessHead) ? Number(row.BusinessHead) : null);
            }

            const firstSlug = slugify(FirstName);
            const lastSlug = slugify(LastName);

            const finalUsername = row.Username || (firstSlug && lastSlug ? `${firstSlug}.${lastSlug}` : '');
            const finalEmail = row.Email || (firstSlug && lastSlug ? `${firstSlug}.${lastSlug}@rubamin.com` : '');

            const userData = {
                EmployeeCode: row.EmployeeCode ? String(row.EmployeeCode) : null,
                Username: finalUsername,
                Email: finalEmail,
                FirstName: FirstName,
                LastName: LastName || '',
                MobileNo: row.MobileNo ? String(row.MobileNo) : null,
                DepartmentID: departmentID,
                Designation: row.Designation || null,
                Grade: row.Grade || null,
                Post: row.Post || null,
                ReportingManagerID: reportingManagerID,
                HODID: hodID,
                BusinessHeadID: businessHeadID,
                Role: row.Role || 'Employee',
                PasswordHash: DEFAULT_PASSWORD || 'Rubamin@123'
            };

            const result = await registerUser(userData);

            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                errors.push(`Row ${i + 2}: ${result.message}`);
            }
        }

        fs.unlinkSync(filePath);

        return res.status(200).json({
            success: true,
            message: `Employee Excel processing completed. Success: ${successCount}, Errors: ${errorCount}.`,
            data: { successCount, errorCount, errors }
        });

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('Excel Import Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process employee upload spreadsheet.',
            errors: error.message
        });
    }
};

module.exports = {
    getDropdownData,
    getAllEmployees,
    downloadTemplate,
    createEmployee,
    uploadEmployeesExcel,
    validateReportingHierarchyFixed,
    validateReportingHierarchyWithDb,
};