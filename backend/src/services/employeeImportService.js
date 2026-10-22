const bcrypt = require("bcrypt");
const { poolPromise, sql } = require("../config/db");
const { DEFAULT_PASSWORD } = require("../constants/constants");
const {
  parseEmployeeWorkbook,
  splitEmployeeName,
  baseUsername,
  normaliseMobile,
  normaliseEmail,
  departmentCandidates,
  personNameKey,
  firstLastKey,
  codeCandidates,
  EMAIL_RE,
} = require("../utils/employeeImportParser");

// Same library and rounds as authService.registerUser (single Add Employee).
const SALT_ROUNDS = 10;

const MAX_LENGTHS = {
  EmployeeCode: 20,
  Email: 150,
  FirstName: 100,
  LastName: 100,
  Designation: 150,
  Grade: 50,
  MobileNo: 20,
  Username: 100,
};

const HIERARCHY_FIELDS = [
  { key: "reportingManager", column: "ReportingManagerID", label: "Reporting Manager" },
  { key: "hod", column: "HODID", label: "Division Head / HOD" },
  { key: "businessHead", column: "BusinessHeadID", label: "Business Head" },
];

// Thrown to roll back and answer 400 with row-numbered errors.
class ImportValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.errors = errors;
  }
}

const lower = (v) => String(v ?? "").trim().toLowerCase();
const fullName = (u) => [u.FirstName, u.LastName].filter(Boolean).join(" ");

/**
 * Department name -> lowest DepartmentID, case-insensitive.
 * DepartmentName is not unique; lowest ID matches getUniqueDepartments() used by the Add Employee form.
 */
const buildDepartmentMap = (departments) => {
  const map = new Map();
  departments.forEach((d) => {
    const key = lower(d.DepartmentName).replace(/\s+/g, " ");
    if (!key) return;
    const existing = map.get(key);
    if (!existing || d.DepartmentID < existing.DepartmentID) map.set(key, d);
  });
  return map;
};

const findDepartment = (map, raw) => {
  for (const candidate of departmentCandidates(raw)) {
    const dept = map.get(lower(candidate));
    if (dept) return dept;
  }
  return null;
};

/** Validate and normalise every row; returns { records, errors }. */
const validateRows = (rows, { deptMap, usersByEmail }) => {
  const errors = [];
  const records = [];
  const seenCodes = new Map();
  const seenEmails = new Map();

  rows.forEach((r) => {
    const rowErrors = [];
    const employeeCode = r.employeeCode || "";
    const email = normaliseEmail(r.email);
    const name = splitEmployeeName(r.employeeName);
    const mobile = normaliseMobile(r.mobile);

    if (!employeeCode) rowErrors.push("Employee Code is required.");
    if (!r.employeeName || !name.firstName) rowErrors.push("Employee Name is required.");
    if (!email) rowErrors.push("Official Email ID is required.");
    if (!r.department) rowErrors.push("Department is required.");

    if (email && !EMAIL_RE.test(email)) rowErrors.push(`Official Email ID '${email}' is not a valid email.`);
    if (mobile.value !== null && mobile.digits < 10)
      rowErrors.push(`Mobile Number '${r.mobile}' has fewer than 10 digits.`);

    if (employeeCode) {
      const codeKey = lower(employeeCode);
      if (seenCodes.has(codeKey))
        rowErrors.push(`Duplicate Employee Code '${employeeCode}' (also on row ${seenCodes.get(codeKey)}).`);
      else seenCodes.set(codeKey, r.row);
    }
    if (email) {
      const emailKey = lower(email);
      if (seenEmails.has(emailKey))
        rowErrors.push(`Duplicate Official Email ID '${email}' (also on row ${seenEmails.get(emailKey)}).`);
      else seenEmails.set(emailKey, r.row);

      const owner = usersByEmail.get(emailKey);
      if (owner && lower(owner.EmployeeCode) !== lower(employeeCode))
        rowErrors.push(`Official Email ID '${email}' already belongs to Employee Code '${owner.EmployeeCode}'.`);
    }

    const values = {
      EmployeeCode: employeeCode,
      Email: email,
      FirstName: name.firstName,
      LastName: name.lastName,
      Designation: r.designation || null,
      Grade: r.grade || null,
      MobileNo: mobile.value,
    };
    Object.entries(values).forEach(([column, value]) => {
      if (value && value.length > MAX_LENGTHS[column])
        rowErrors.push(`${column} is longer than ${MAX_LENGTHS[column]} characters.`);
    });

    let department = null;
    if (r.department) {
      department = findDepartment(deptMap, r.department);
      if (!department) rowErrors.push(`Department '${r.department}' was not found.`);
    }

    if (rowErrors.length) {
      errors.push({ row: r.row, employeeCode, errors: rowErrors });
      return;
    }

    records.push({
      row: r.row,
      ...values,
      DepartmentID: department.DepartmentID,
      nameWords: name.words,
      hierarchyRaw: {
        reportingManager: r.reportingManager || "",
        hod: r.hod || "",
        businessHead: r.businessHead || "",
      },
    });
  });

  return { records, errors };
};

/** Lookup of active users for hierarchy resolution. */
const buildPersonIndex = (users) => {
  const byCode = new Map();
  const byFullName = new Map();
  const byFirstLast = new Map();
  const push = (map, key, user) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(user);
  };
  users.forEach((u) => {
    byCode.set(lower(u.EmployeeCode), u);
    const key = personNameKey(fullName(u));
    push(byFullName, key, u);
    push(byFirstLast, firstLastKey(key), u);
  });
  return { byCode, byFullName, byFirstLast };
};

/**
 * Resolve a hierarchy cell to a user:
 * 1. Employee Code (whole value or code in brackets)  2. exact full name  3. first + last word (unique only)
 * Returns { user } or { error }.
 */
const resolvePerson = (raw, index) => {
  for (const code of codeCandidates(raw)) {
    const user = index.byCode.get(lower(code));
    if (user) return { user };
  }
  const key = personNameKey(raw);
  if (!key) return { error: "not found" };

  const exact = index.byFullName.get(key) || [];
  if (exact.length === 1) return { user: exact[0] };
  if (exact.length > 1) return { error: `ambiguous (matches ${exact.length} users)` };

  const partial = index.byFirstLast.get(firstLastKey(key)) || [];
  if (partial.length === 1) return { user: partial[0] };
  if (partial.length > 1) return { error: `ambiguous (matches ${partial.length} users by first and last name)` };
  return { error: "not found" };
};

/**
 * Import employees from HR's Excel export.
 * Everything runs in one transaction; dryRun rolls back after building the report.
 */
const importEmployees = async (buffer, { dryRun = false, deactivateMissing = false } = {}) => {
  let parsed;
  try {
    parsed = await parseEmployeeWorkbook(buffer);
  } catch (error) {
    throw new ImportValidationError("Could not read the Excel file. Please upload a valid .xlsx file.", [
      { row: null, employeeCode: null, errors: [error.message] },
    ]);
  }

  if (!parsed.headerRow || parsed.missingHeaders.length) {
    throw new ImportValidationError("Required columns are missing.", [
      {
        row: parsed.headerRow,
        employeeCode: null,
        errors: [`Missing columns: ${parsed.missingHeaders.join(", ")}.`],
      },
    ]);
  }
  if (!parsed.rows.length) {
    throw new ImportValidationError("The Excel sheet has no employee rows.", []);
  }

  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const request = () => new sql.Request(transaction);

  try {
    const deptResult = await request().query(
      "SELECT DepartmentID, DepartmentName FROM dbo.Departments",
    );
    const usersResult = await request().query(`
      SELECT UserID, EmployeeCode, Username, Email, ReportingManagerID, HODID, BusinessHeadID, Role
      FROM dbo.Users
    `);

    const existingByCode = new Map();
    const usersByEmail = new Map();
    const takenUsernames = new Set();
    usersResult.recordset.forEach((u) => {
      existingByCode.set(lower(u.EmployeeCode), u);
      if (u.Email) usersByEmail.set(lower(u.Email), u);
      takenUsernames.add(lower(u.Username));
    });

    const { records, errors } = validateRows(parsed.rows, {
      deptMap: buildDepartmentMap(deptResult.recordset),
      usersByEmail,
    });
    if (errors.length) {
      throw new ImportValidationError(
        `Validation failed for ${errors.length} row(s). Nothing was saved.`,
        errors,
      );
    }

    // ---------- Insert / update ----------
    const report = {
      dryRun,
      totalRows: records.length,
      inserted: 0,
      updated: 0,
      deactivated: 0,
      ignoredColumns: parsed.ignoredColumns,
      newUsers: [],
      warnings: [],
      hierarchy: [],
    };

    const needsPassword = records.some((rec) => !existingByCode.has(lower(rec.EmployeeCode)));
    // One hash for the shared default password; each user is forced to change it on first login.
    const passwordHash = needsPassword
      ? await bcrypt.hash(process.env.DEFAULT_EMPLOYEE_PASSWORD || DEFAULT_PASSWORD, SALT_ROUNDS)
      : null;

    for (const rec of records) {
      const existing = existingByCode.get(lower(rec.EmployeeCode));
      const req = request()
        .input("EmployeeCode", sql.VarChar(20), rec.EmployeeCode)
        .input("Email", sql.NVarChar(150), rec.Email)
        .input("FirstName", sql.NVarChar(100), rec.FirstName)
        .input("LastName", sql.NVarChar(100), rec.LastName)
        .input("MobileNo", sql.VarChar(20), rec.MobileNo)
        .input("DepartmentID", sql.Int, rec.DepartmentID)
        .input("Designation", sql.NVarChar(150), rec.Designation)
        .input("Grade", sql.NVarChar(50), rec.Grade);

      if (existing) {
        // Empty Excel cells never overwrite existing data. Username, passwords, Post and Role untouched.
        await req.input("UserID", sql.Int, existing.UserID).query(`
          UPDATE dbo.Users SET
            FirstName = COALESCE(@FirstName, FirstName),
            LastName = COALESCE(@LastName, LastName),
            Email = COALESCE(@Email, Email),
            MobileNo = COALESCE(@MobileNo, MobileNo),
            DepartmentID = COALESCE(@DepartmentID, DepartmentID),
            Designation = COALESCE(@Designation, Designation),
            Grade = COALESCE(@Grade, Grade),
            IsActive = 1,
            ModifiedDate = GETDATE()
          WHERE UserID = @UserID
        `);
        rec.UserID = existing.UserID;
        rec.existing = existing;
        report.updated++;
        continue;
      }

      const base = baseUsername(rec.nameWords, rec.EmployeeCode).slice(0, MAX_LENGTHS.Username - 3);
      let username = base;
      for (let n = 2; takenUsernames.has(username); n++) username = `${base}${n}`;
      takenUsernames.add(username);

      const result = await req
        .input("Username", sql.VarChar(100), username)
        .input("PasswordHash", sql.NVarChar(sql.MAX), passwordHash)
        .query(`
          INSERT INTO dbo.Users (
            EmployeeCode, Username, PasswordHash, Email, FirstName, LastName, MobileNo,
            DepartmentID, Designation, Grade, Post, Role, IsActive, CreatedDate, ModifiedDate,
            DefaultPasswordFlag, PasswordChangedDate, FailedLoginCount, IsLocked, IsPasswordChanged
          )
          OUTPUT INSERTED.UserID
          VALUES (
            @EmployeeCode, @Username, @PasswordHash, @Email, @FirstName, @LastName, @MobileNo,
            @DepartmentID, @Designation, @Grade, NULL, 'Employee', 1, GETDATE(), GETDATE(),
            1, NULL, 0, 0, 0
          )
        `);
      rec.UserID = result.recordset[0].UserID;
      rec.existing = null;
      report.inserted++;
      report.newUsers.push({ row: rec.row, employeeCode: rec.EmployeeCode, username });
    }

    // ---------- Deactivate users missing from the file (never Admins) ----------
    if (deactivateMissing) {
      const result = await request()
        .input("Codes", sql.NVarChar(sql.MAX), JSON.stringify(records.map((rec) => rec.EmployeeCode)))
        .query(`
          UPDATE dbo.Users SET IsActive = 0, ModifiedDate = GETDATE()
          WHERE IsActive = 1
            AND Role <> 'Admin'
            AND EmployeeCode NOT IN (SELECT value COLLATE DATABASE_DEFAULT FROM OPENJSON(@Codes))
        `);
      report.deactivated = result.rowsAffected[0];
    }

    // ---------- Hierarchy (after all rows exist, so managers further down the sheet resolve) ----------
    const activeUsers = await request().query(`
      SELECT UserID, EmployeeCode, FirstName, LastName FROM dbo.Users WHERE IsActive = 1
    `);
    const index = buildPersonIndex(activeUsers.recordset);
    const usersById = new Map(activeUsers.recordset.map((u) => [u.UserID, u]));
    const nameOf = (id) => (id && usersById.has(id) ? fullName(usersById.get(id)) : null);

    for (const rec of records) {
      const resolved = {};
      const warn = (message) => report.warnings.push({ row: rec.row, employeeCode: rec.EmployeeCode, message });

      for (const field of HIERARCHY_FIELDS) {
        const raw = rec.hierarchyRaw[field.key];
        const existingId = rec.existing ? rec.existing[field.column] : null;
        if (!raw) {
          resolved[field.key] = { id: null, source: "empty", found: false };
          continue;
        }
        const match = resolvePerson(raw, index);
        if (match.user && match.user.UserID === rec.UserID) {
          warn(`${field.label} '${raw}' is the employee themselves; left empty.`);
          resolved[field.key] = { id: null, source: "empty", found: false };
        } else if (match.user) {
          resolved[field.key] = { id: match.user.UserID, source: "excel", found: true };
        } else {
          warn(`${field.label} '${raw}' ${match.error}; kept existing value.`);
          resolved[field.key] = { id: existingId, source: "unchanged", found: false };
        }
      }

      // Reporting Manager empty or not found -> Business Head, unless that is the employee themselves.
      const rm = resolved.reportingManager;
      const bh = resolved.businessHead;
      if (!rm.found && bh.found && bh.id !== rec.UserID) {
        resolved.reportingManager = { id: bh.id, source: "businessHead", found: true };
      }

      await request()
        .input("UserID", sql.Int, rec.UserID)
        .input("ReportingManagerID", sql.Int, resolved.reportingManager.id)
        .input("HODID", sql.Int, resolved.hod.id)
        .input("BusinessHeadID", sql.Int, resolved.businessHead.id)
        .query(`
          UPDATE dbo.Users SET
            ReportingManagerID = @ReportingManagerID,
            HODID = @HODID,
            BusinessHeadID = @BusinessHeadID,
            ModifiedDate = GETDATE()
          WHERE UserID = @UserID
        `);

      const entry = (r) => ({ name: nameOf(r.id), source: r.source });
      report.hierarchy.push({
        row: rec.row,
        employeeCode: rec.EmployeeCode,
        userId: rec.UserID,
        name: fullName(rec),
        reportingManager: entry(resolved.reportingManager),
        hod: entry(resolved.hod),
        businessHead: entry(resolved.businessHead),
      });
    }

    // ---------- Role: derived from who is named as BusinessHead / HOD / Manager among active users ----------
    const roleResult = await request()
      .input("UserIDs", sql.NVarChar(sql.MAX), JSON.stringify(records.map((rec) => rec.UserID)))
      .query(`
        ;WITH Derived AS (
          SELECT u.UserID, u.Role,
            CASE
              WHEN EXISTS (SELECT 1 FROM dbo.Users x WHERE x.IsActive = 1 AND x.UserID <> u.UserID AND x.BusinessHeadID = u.UserID) THEN 'BusinessHead'
              WHEN EXISTS (SELECT 1 FROM dbo.Users x WHERE x.IsActive = 1 AND x.UserID <> u.UserID AND x.HODID = u.UserID) THEN 'HOD'
              WHEN EXISTS (SELECT 1 FROM dbo.Users x WHERE x.IsActive = 1 AND x.UserID <> u.UserID AND x.ReportingManagerID = u.UserID) THEN 'Manager'
              ELSE 'Employee'
            END AS NewRole
          FROM dbo.Users u
          WHERE u.UserID IN (SELECT CAST(value AS INT) FROM OPENJSON(@UserIDs))
            AND u.Role <> 'Admin'
        )
        UPDATE u SET u.Role = d.NewRole, u.ModifiedDate = GETDATE()
        OUTPUT INSERTED.UserID, INSERTED.Role
        FROM dbo.Users u
        JOIN Derived d ON d.UserID = u.UserID
        WHERE d.Role <> d.NewRole
      `);
    const roleChanges = new Map(roleResult.recordset.map((r) => [r.UserID, r.Role]));
    const finalRoles = await request()
      .input("UserIDs", sql.NVarChar(sql.MAX), JSON.stringify(records.map((rec) => rec.UserID)))
      .query("SELECT UserID, Role FROM dbo.Users WHERE UserID IN (SELECT CAST(value AS INT) FROM OPENJSON(@UserIDs))");
    const roleById = new Map(finalRoles.recordset.map((r) => [r.UserID, r.Role]));
    report.hierarchy.forEach((h) => {
      h.role = roleById.get(h.userId);
      h.roleChanged = roleChanges.has(h.userId);
    });

    if (dryRun) await transaction.rollback();
    else await transaction.commit();
    return report;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Already rolled back (e.g. SQL Server aborted the transaction).
    }
    throw error;
  }
};

module.exports = {
  importEmployees,
  ImportValidationError,
};
