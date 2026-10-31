const { poolPromise, sql } = require("../config/db");
const { issueTemporaryPassword } = require("./authService");
const {
  parseEmployeeWorkbook,
  baseUsername,
  normaliseMobile,
  normaliseEmail,
  departmentCandidates,
  parseManagerName,
  matchKey,
  EMAIL_RE,
} = require("../utils/employeeImportParser");

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
const POST_MAX_LENGTH = 100;

// Thrown to roll back and answer 400 with row-numbered errors.
class ImportValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.errors = errors;
  }
}

const lower = (v) => String(v ?? "").trim().toLowerCase();
const fullName = (u) => [u.FirstName, u.LastName].filter(Boolean).join(" ");
const rowName = (r) => r.displayName || [r.firstName, r.lastName].filter(Boolean).join(" ");

/**
 * Department name -> lowest DepartmentID, case-insensitive.
 * DepartmentName is not unique; lowest ID matches getUniqueDepartments() used by the Add Employee form.
 */
const buildDepartmentMap = (departments) => {
  const map = new Map();
  departments.forEach((d) => {
    const key = matchKey(d.DepartmentName);
    if (!key) return;
    const existing = map.get(key);
    if (!existing || d.DepartmentID < existing.DepartmentID) map.set(key, d);
  });
  return map;
};

const findDepartment = (map, raw) => {
  for (const candidate of departmentCandidates(raw)) {
    const dept = map.get(matchKey(candidate));
    if (dept) return dept;
  }
  return null;
};

const pushTo = (map, key, value) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  if (!map.get(key).some((v) => v.UserID === value.UserID)) map.get(key).push(value);
};

// "first|last" match key; empty when either part is blank.
const nameKey = (first, last) => {
  const f = matchKey(first);
  const l = matchKey(last);
  return f && l ? `${f}|${l}` : "";
};

/**
 * Narrow same first + last name candidates by middle name:
 * equal middle names, or the same first letter (initials like "B").
 * With no middle name to compare, nothing is narrowed.
 */
const narrowByMiddleName = (candidates, middle) => {
  const target = matchKey(middle);
  if (!target) return candidates;
  return candidates.filter((c) => {
    const own = matchKey(c.middle);
    return own && (own === target || own[0] === target[0]);
  });
};

/**
 * Split rows into records to upload, rows not uploaded (with reason) and non-active rows.
 * A row whose email belongs to the Business Head is treated as the Business Head's row.
 */
const validateRows = (rows, { deptMap, existingByCode, usersByEmail, businessHead }) => {
  const records = [];
  const notUploaded = [];
  const skippedInactive = [];
  const mobileNotSaved = [];
  const seenCodes = new Map();
  const seenEmails = new Map();

  rows.forEach((r) => {
    const employeeCode = r.employeeCode || "";
    const name = rowName(r);

    if (lower(r.status) !== "active") {
      skippedInactive.push({ row: r.row, employeeCode, name, status: r.status });
      return;
    }

    const reasons = [];
    const email = normaliseEmail(r.email);

    if (!employeeCode) reasons.push("User/Employee ID is blank.");
    if (!r.firstName) reasons.push("First Name is blank.");
    if (!email) reasons.push("Business email is blank.");
    else if (!EMAIL_RE.test(email)) reasons.push(`Business email '${email}' is not a valid email.`);

    let existing = employeeCode ? existingByCode.get(lower(employeeCode)) : null;
    if (employeeCode) {
      const codeKey = lower(employeeCode);
      if (seenCodes.has(codeKey))
        reasons.push(`Duplicate User/Employee ID '${employeeCode}' (also on row ${seenCodes.get(codeKey)}).`);
      else seenCodes.set(codeKey, r.row);
    }
    if (email) {
      const emailKey = lower(email);
      if (seenEmails.has(emailKey))
        reasons.push(`Duplicate business email '${email}' (also on row ${seenEmails.get(emailKey)}).`);
      else seenEmails.set(emailKey, r.row);

      const owner = usersByEmail.get(emailKey);
      if (owner && !existing && owner.UserID === businessHead.UserID) existing = businessHead;
      if (owner && owner !== existing)
        reasons.push(`Business email '${email}' already belongs to Employee Code '${owner.EmployeeCode}'.`);
    }

    const values = {
      EmployeeCode: employeeCode,
      Email: email,
      FirstName: r.firstName,
      LastName: r.lastName || null,
      Designation: r.designation || null,
      Grade: r.grade || null,
    };
    Object.entries(values).forEach(([column, value]) => {
      if (value && value.length > MAX_LENGTHS[column])
        reasons.push(`${column} is longer than ${MAX_LENGTHS[column]} characters.`);
    });

    const department = r.department ? findDepartment(deptMap, r.department) : null;
    if (!department) reasons.push(`Department not found: ${r.department || "(blank)"}`);

    if (reasons.length) {
      notUploaded.push({ row: r.row, employeeCode, name, reason: reasons.join(" ") });
      return;
    }

    // Personal phone first, then official; too long for the column -> saved without a mobile number.
    const phoneFromFile = r.personalPhone || r.officialPhone;
    let mobileNo = normaliseMobile(phoneFromFile);
    if (mobileNo && mobileNo.length > MAX_LENGTHS.MobileNo) {
      mobileNotSaved.push({ row: r.row, employeeCode, name, value: phoneFromFile });
      mobileNo = null;
    }

    records.push({
      row: r.row,
      ...values,
      MobileNo: mobileNo,
      Post: values.Designation ? values.Designation.slice(0, POST_MAX_LENGTH) : null,
      DepartmentID: department.DepartmentID,
      middleName: r.middleName,
      name,
      reportingManager: r.reportingManager,
      existing: existing || null,
    });
  });

  return { records, notUploaded, skippedInactive, mobileNotSaved };
};

/**
 * Import employees from HR's Excel export.
 * Everything runs in one transaction; dryRun rolls back after building the report.
 *
 * Returns { report, welcomeMails }. welcomeMails holds each created user with
 * their own temporary password, for the welcome email after the commit (empty
 * on a dry run). It must never be sent back in the response; report is safe.
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
    throw new ImportValidationError(
      `Required column(s) missing: ${parsed.missingHeaders.join(", ")}. Nothing was saved.`,
      [
        {
          row: parsed.headerRow,
          employeeCode: null,
          errors: [`Missing columns: ${parsed.missingHeaders.join(", ")}.`],
        },
      ],
    );
  }
  if (!parsed.rows.length) {
    throw new ImportValidationError("The Excel sheet has no employee rows.", []);
  }

  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const request = () => new sql.Request(transaction);

  try {
    // ---------- Business Head: exactly one active user with Role BusinessHead ----------
    const bhResult = await request().query(`
      SELECT UserID, EmployeeCode, Email, FirstName, LastName
      FROM dbo.Users WHERE Role = 'BusinessHead' AND IsActive = 1
    `);
    if (bhResult.recordset.length !== 1) {
      const found = bhResult.recordset.length;
      throw new ImportValidationError(
        found === 0
          ? "No active user with role BusinessHead exists. Create the Business Head before uploading. Nothing was saved."
          : `${found} active users have role BusinessHead (${bhResult.recordset
              .map((u) => `${fullName(u)} [${u.EmployeeCode}]`)
              .join(", ")}); exactly one is required. Nothing was saved.`,
        [],
      );
    }

    const deptResult = await request().query(
      "SELECT DepartmentID, DepartmentName FROM dbo.Departments",
    );
    const usersResult = await request().query(`
      SELECT UserID, EmployeeCode, Username, Email, FirstName, LastName, Role
      FROM dbo.Users
    `);

    const existingByCode = new Map();
    const usersByEmail = new Map();
    const takenUsernames = new Set();
    let businessHead = null;
    usersResult.recordset.forEach((u) => {
      existingByCode.set(lower(u.EmployeeCode), u);
      if (u.Email) usersByEmail.set(lower(u.Email), u);
      takenUsernames.add(lower(u.Username));
      if (u.UserID === bhResult.recordset[0].UserID) businessHead = u;
    });

    const { records, notUploaded, skippedInactive, mobileNotSaved } = validateRows(parsed.rows, {
      deptMap: buildDepartmentMap(deptResult.recordset),
      existingByCode,
      usersByEmail,
      businessHead,
    });

    const report = {
      dryRun,
      totalRows: parsed.rows.length,
      inserted: 0,
      updated: 0,
      deactivated: 0,
      businessHead: { name: fullName(businessHead), employeeCode: businessHead.EmployeeCode },
      newUsers: [],
      notUploaded,
      managerNotLinked: [],
      skippedInactive,
      mobileNotSaved,
      hierarchy: [],
    };

    // ---------- Pass 1: insert / update ----------
    // Every new user gets their own temporary password (DefaultPasswordFlag = 1 below forces a
    // change on first login). Hashed up front and in parallel to keep the transaction short.
    const credentials = new Map();
    await Promise.all(
      records
        .filter((rec) => !rec.existing)
        .map(async (rec) => credentials.set(rec, await issueTemporaryPassword())),
    );
    const welcomeMails = [];

    // First + Last Name (from the file) -> [{ UserID, middle }], for manager linking in pass 2.
    const fileNames = new Map();

    for (const rec of records) {
      const req = request()
        .input("EmployeeCode", sql.VarChar(20), rec.EmployeeCode)
        .input("Email", sql.NVarChar(150), rec.Email)
        .input("FirstName", sql.NVarChar(100), rec.FirstName)
        .input("LastName", sql.NVarChar(100), rec.LastName)
        .input("MobileNo", sql.VarChar(20), rec.MobileNo)
        .input("DepartmentID", sql.Int, rec.DepartmentID)
        .input("Designation", sql.NVarChar(150), rec.Designation)
        .input("Grade", sql.NVarChar(50), rec.Grade)
        .input("Post", sql.NVarChar(100), rec.Post);

      if (rec.existing) {
        // Empty Excel cells never overwrite existing data. EmployeeCode, Username, passwords and Role untouched.
        await req.input("UserID", sql.Int, rec.existing.UserID).query(`
          UPDATE dbo.Users SET
            FirstName = COALESCE(@FirstName, FirstName),
            LastName = COALESCE(@LastName, LastName),
            Email = COALESCE(@Email, Email),
            MobileNo = COALESCE(@MobileNo, MobileNo),
            DepartmentID = COALESCE(@DepartmentID, DepartmentID),
            Designation = COALESCE(@Designation, Designation),
            Post = COALESCE(@Post, Post),
            Grade = COALESCE(@Grade, Grade),
            IsActive = 1,
            ModifiedDate = GETDATE()
          WHERE UserID = @UserID
        `);
        rec.UserID = rec.existing.UserID;
        report.updated++;
      } else {
        const base = baseUsername(rec.FirstName, rec.LastName).slice(0, MAX_LENGTHS.Username - 3);
        let username = base;
        for (let n = 2; takenUsernames.has(username); n++) username = `${base}${n}`;
        takenUsernames.add(username);

        const result = await req
          .input("Username", sql.VarChar(100), username)
          .input("PasswordHash", sql.NVarChar(sql.MAX), credentials.get(rec).passwordHash)
          .query(`
            INSERT INTO dbo.Users (
              EmployeeCode, Username, PasswordHash, Email, FirstName, LastName, MobileNo,
              DepartmentID, Designation, Grade, Post, Role, IsActive, CreatedDate, ModifiedDate,
              DefaultPasswordFlag, PasswordChangedDate, FailedLoginCount, IsLocked, IsPasswordChanged
            )
            OUTPUT INSERTED.UserID
            VALUES (
              @EmployeeCode, @Username, @PasswordHash, @Email, @FirstName, @LastName, @MobileNo,
              @DepartmentID, @Designation, @Grade, @Post, 'Employee', 1, GETDATE(), GETDATE(),
              1, NULL, 0, 0, 0
            )
          `);
        rec.UserID = result.recordset[0].UserID;
        report.inserted++;
        report.newUsers.push({ row: rec.row, employeeCode: rec.EmployeeCode, name: rec.name, username });
        welcomeMails.push({
          user: {
            UserID: rec.UserID,
            Username: username,
            EmployeeCode: rec.EmployeeCode,
            FirstName: rec.FirstName,
            LastName: rec.LastName,
            Email: rec.Email,
          },
          temporaryPassword: credentials.get(rec).temporaryPassword,
        });
      }

      pushTo(fileNames, nameKey(rec.FirstName, rec.LastName), { UserID: rec.UserID, middle: rec.middleName });
    }

    // ---------- Deactivate users missing from the file (never Admins or the Business Head) ----------
    if (deactivateMissing) {
      const keepCodes = [...records, ...notUploaded].map((r) => r.EmployeeCode || r.employeeCode).filter(Boolean);
      const result = await request()
        .input("Codes", sql.NVarChar(sql.MAX), JSON.stringify(keepCodes))
        .input("BusinessHeadID", sql.Int, businessHead.UserID)
        .query(`
          UPDATE dbo.Users SET IsActive = 0, ModifiedDate = GETDATE()
          WHERE IsActive = 1
            AND Role <> 'Admin'
            AND UserID <> @BusinessHeadID
            AND EmployeeCode NOT IN (SELECT value COLLATE DATABASE_DEFAULT FROM OPENJSON(@Codes))
        `);
      report.deactivated = result.rowsAffected[0];
    }

    // ---------- Pass 2: link managers (after all rows exist, so managers further down the sheet resolve) ----------
    const activeUsers = await request().query(`
      SELECT UserID, EmployeeCode, FirstName, LastName FROM dbo.Users WHERE IsActive = 1
    `);
    const dbNames = new Map();
    activeUsers.recordset.forEach((u) => pushTo(dbNames, nameKey(u.FirstName, u.LastName), { UserID: u.UserID, middle: "" }));
    const usersById = new Map(activeUsers.recordset.map((u) => [u.UserID, u]));
    const nameOf = (id) => (id && usersById.has(id) ? fullName(usersById.get(id)) : null);

    for (const rec of records) {
      const entry = { row: rec.row, employeeCode: rec.EmployeeCode, userId: rec.UserID, name: rec.name };
      report.hierarchy.push(entry);

      // The Business Head's own row: details were updated in pass 1; hierarchy and role stay as they are.
      if (rec.UserID === businessHead.UserID) {
        entry.reportingManager = { name: null, source: "unchanged" };
        continue;
      }

      let managerId = null;
      let source;
      if (!rec.reportingManager) {
        managerId = businessHead.UserID;
        source = "businessHead";
      } else {
        const parsedName = parseManagerName(rec.reportingManager);
        const key = nameKey(parsedName.first, parsedName.last);
        let candidates = fileNames.get(key) || [];
        source = "file";
        if (!candidates.length) {
          candidates = dbNames.get(key) || [];
          source = "database";
        }
        const multiple = candidates.length > 1;
        if (multiple) candidates = narrowByMiddleName(candidates, parsedName.middle);

        if (candidates.length === 1 && candidates[0].UserID !== rec.UserID) {
          managerId = candidates[0].UserID;
        } else {
          source = "notLinked";
          report.managerNotLinked.push({
            row: rec.row,
            employeeCode: rec.EmployeeCode,
            name: rec.name,
            reportingManager: rec.reportingManager,
            parsedFirstName: parsedName.first,
            parsedLastName: parsedName.last,
            reason:
              candidates.length > 1 || (multiple && !candidates.length)
                ? "multiple matches"
                : candidates.length === 1
                  ? "matches the employee themselves"
                  : "no matching user",
          });
        }
      }

      // Reporting to the Business Head is stored as empty ReportingManagerID / HODID with BusinessHeadID set,
      // which is what the existing one-time Business Head approval (isDirectBusinessHeadReport) expects.
      const reportsToBusinessHead = managerId === businessHead.UserID;
      const linkedId = reportsToBusinessHead ? null : managerId;

      await request()
        .input("UserID", sql.Int, rec.UserID)
        .input("ReportingManagerID", sql.Int, linkedId)
        .input("HODID", sql.Int, linkedId)
        .input("BusinessHeadID", sql.Int, businessHead.UserID)
        .query(`
          UPDATE dbo.Users SET
            ReportingManagerID = @ReportingManagerID,
            HODID = @HODID,
            BusinessHeadID = @BusinessHeadID,
            ModifiedDate = GETDATE()
          WHERE UserID = @UserID
        `);

      entry.reportingManager = {
        name: reportsToBusinessHead ? fullName(businessHead) : nameOf(managerId),
        source: reportsToBusinessHead && source !== "businessHead" ? "businessHeadMatched" : source,
      };
    }

    // ---------- Role: users with at least one active direct report become Manager ----------
    // HODID always equals ReportingManagerID in this import, so there is no separate HOD signal.
    // The Business Head keeps their role.
    const roleUserIds = JSON.stringify(
      records.map((rec) => rec.UserID).filter((id) => id !== businessHead.UserID),
    );
    const roleResult = await request()
      .input("UserIDs", sql.NVarChar(sql.MAX), roleUserIds)
      .query(`
        ;WITH Derived AS (
          SELECT u.UserID, u.Role,
            CASE
              WHEN EXISTS (SELECT 1 FROM dbo.Users x WHERE x.IsActive = 1 AND x.UserID <> u.UserID AND x.ReportingManagerID = u.UserID) THEN 'Manager'
              ELSE 'Employee'
            END AS NewRole
          FROM dbo.Users u
          WHERE u.UserID IN (SELECT CAST(value AS INT) FROM OPENJSON(@UserIDs))
            AND u.Role NOT IN ('Admin', 'BusinessHead')
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

    if (dryRun) {
      await transaction.rollback();
      return { report, welcomeMails: [] };
    }
    await transaction.commit();
    return { report, welcomeMails };
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
