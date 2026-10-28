const ExcelJS = require("exceljs");

/**
 * Parsing and normalisation helpers for the HR employee Excel import.
 * The file is HR's full system export (200+ columns); only the columns below are read.
 * No DB access here; see services/employeeImportService.js.
 */

// Trim, collapse whitespace (incl. non-breaking spaces).
const cleanText = (value) =>
  String(value ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Header / name match key: trimmed, repeated spaces collapsed, case ignored.
const matchKey = (value) => cleanText(value).toLowerCase();

// Export headers (matchKey form) -> field name. Every other column is ignored.
const HEADER_FIELDS = {
  "user/employee id": "employeeCode",
  "display name": "displayName",
  "first name": "firstName",
  "middle name": "middleName",
  "last name": "lastName",
  "business email information email address": "email",
  "personal formatted phone number": "personalPhone",
  "official phone information phone number": "officialPhone",
  designation: "designation",
  "pay grade": "grade",
  department: "department",
  "reporting manager": "reportingManager",
  "employee status": "status",
};

const REQUIRED_HEADERS = {
  employeeCode: "User/Employee ID",
  displayName: "Display Name",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Business Email Information Email Address",
  department: "Department",
  designation: "Designation",
  reportingManager: "Reporting Manager",
  status: "Employee Status",
};

const HEADER_SCAN_ROWS = 10;

// lowercase first + "." + lowercase last, spaces inside the names removed.
const baseUsername = (firstName, lastName) => {
  const first = String(firstName || "").replace(/\s+/g, "").toLowerCase();
  const last = String(lastName || "").replace(/\s+/g, "").toLowerCase();
  return last ? `${first}.${last}` : first;
};

// Phone columns are read with cellText so numbers keep every digit.
const PHONE_FIELDS = new Set(["personalPhone", "officialPhone"]);

/**
 * Cell value as text, never as a number: whole numbers are written out in full
 * (no 9.87654E+09), and rich text / hyperlink / formula objects give their text.
 */
const cellText = (cell) => {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 })
      : String(value);
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  if (value.text !== undefined) return String(value.text);
  if (value.result !== undefined) return cellText({ value: value.result });
  return cell.text;
};

// Trim, drop spaces, dashes, dots and brackets; a leading "+" stays ("+91 98765-43210" -> "+919876543210").
const normaliseMobile = (raw) => {
  const value = String(raw || "").trim().replace(/[\s\-.()[\]{}]/g, "");
  return value || null;
};

/**
 * Reporting Manager cell -> { first, middle, last }.
 * "Upadhyay, Ajaykumar Dhananjay" -> last before the comma, first word after it, rest = middle.
 * "Ajaykumar Dhananjay Upadhyay"  -> first word, last word, words between = middle.
 */
const parseManagerName = (raw) => {
  const value = cleanText(raw);
  const commaAt = value.indexOf(",");
  if (commaAt !== -1) {
    const words = cleanText(value.slice(commaAt + 1)).split(" ").filter(Boolean);
    return {
      first: words[0] || "",
      middle: words.slice(1).join(" "),
      last: cleanText(value.slice(0, commaAt)),
    };
  }
  const words = value.split(" ").filter(Boolean);
  return {
    first: words[0] || "",
    middle: words.slice(1, -1).join(" "),
    last: words.length > 1 ? words[words.length - 1] : "",
  };
};

const EMAIL_RE =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normaliseEmail = (raw) => cleanText(raw).replace(/^mailto:/i, "");

// "14000003-Accounts And Finance" -> ["14000003-Accounts And Finance", "Accounts And Finance"]
const departmentCandidates = (raw) => {
  const full = cleanText(raw);
  const candidates = [full];
  const match = full.match(/^[A-Za-z0-9]+\s*-\s*(.+)$/);
  if (match) candidates.push(cleanText(match[1]));
  return candidates;
};

/**
 * Read the first worksheet of an .xlsx buffer.
 * Header row = the row within the first 10 that matches the most known headers.
 * Columns are found by header name; when a header repeats, the first column wins.
 * Returns { headerRow, missingHeaders, rows: [{ row, ...fields }] }.
 */
const parseEmployeeWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no worksheets.");

  let best = { rowNumber: 0, matches: 0, columns: null };
  const lastScanRow = Math.min(HEADER_SCAN_ROWS, sheet.rowCount);
  for (let r = 1; r <= lastScanRow; r++) {
    const columns = [];
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = matchKey(cell.text);
      if (key) columns.push({ col, key });
    });
    const matches = columns.filter((c) => c.key in HEADER_FIELDS).length;
    if (matches > best.matches) best = { rowNumber: r, matches, columns };
  }

  if (!best.matches) {
    return { headerRow: null, missingHeaders: Object.values(REQUIRED_HEADERS), rows: [] };
  }

  const fieldColumns = {};
  best.columns.forEach(({ col, key }) => {
    const field = HEADER_FIELDS[key];
    if (field && !(field in fieldColumns)) fieldColumns[field] = col;
  });

  const missingHeaders = Object.entries(REQUIRED_HEADERS)
    .filter(([field]) => !(field in fieldColumns))
    .map(([, label]) => label);

  const rows = [];
  for (let r = best.rowNumber + 1; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const record = { row: r };
    let hasValue = false;
    Object.keys(HEADER_FIELDS).forEach((key) => {
      const field = HEADER_FIELDS[key];
      const col = fieldColumns[field];
      const cell = col ? excelRow.getCell(col) : null;
      const text = cell ? cleanText(PHONE_FIELDS.has(field) ? cellText(cell) : cell.text) : "";
      record[field] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push(record);
  }

  return { headerRow: best.rowNumber, missingHeaders, rows };
};

module.exports = {
  parseEmployeeWorkbook,
  baseUsername,
  normaliseMobile,
  normaliseEmail,
  departmentCandidates,
  parseManagerName,
  matchKey,
  cleanText,
  EMAIL_RE,
};
