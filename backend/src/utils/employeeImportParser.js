const ExcelJS = require("exceljs");

/**
 * Parsing and normalisation helpers for the HR employee Excel import.
 * No DB access here; see services/employeeImportService.js.
 */

// Header match key: case, spaces and punctuation ignored.
const headerKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Known HR headers -> field name. `null` = recognised but ignored.
const HEADER_FIELDS = {
  employeecode: "employeeCode",
  employeename: "employeeName",
  officialemailid: "email",
  mobilenumber: "mobile",
  designation: "designation",
  grade: "grade",
  department: "department",
  reportingmanager: "reportingManager",
  divisionheadhod: "hod",
  businesshead: "businessHead",
  profitcenter: null,
  companycode: null,
  plantlocation: null,
};

const REQUIRED_HEADERS = {
  employeeCode: "Employee Code",
  employeeName: "Employee Name",
  email: "Official Email ID",
  department: "Department",
};

const HEADER_SCAN_ROWS = 10;

// Trim, collapse whitespace (incl. non-breaking spaces).
const cleanText = (value) =>
  String(value ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TITLE_RE = /^(mr|mrs|ms|miss|dr|shri|smt)\.?$/i;

// "Last, First Middle" -> "First Middle Last"
const flipComma = (name) => {
  const idx = name.indexOf(",");
  if (idx === -1) return name;
  const last = name.slice(0, idx).trim();
  const first = name.slice(idx + 1).trim();
  return cleanText(`${first} ${last}`);
};

const stripTitles = (words) => {
  const result = [...words];
  while (result.length > 1 && TITLE_RE.test(result[0])) result.shift();
  return result;
};

const toTitleCase = (word) =>
  word.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());

/**
 * Employee Name -> { firstName, lastName, words }.
 * Strips titles, flips "Last, First", converts ALL CAPS to Title Case.
 */
const splitEmployeeName = (rawName) => {
  const name = flipComma(cleanText(rawName));
  let words = stripTitles(name.split(" ").filter(Boolean));

  const letters = words.join("").replace(/[^\p{L}]/gu, "");
  const isAllCaps = letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  if (isAllCaps) words = words.map(toTitleCase);

  return {
    firstName: words[0] || "",
    lastName: words.length > 1 ? words.slice(1).join(" ") : null,
    words,
  };
};

// Same slug rule as the Add Employee form.
const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

// first word + "." + last word ("Kamlesh Hasmuklal Ajmeri" -> kamlesh.ajmeri)
const baseUsername = (words, employeeCode) => {
  const first = slugify(words[0]);
  const last = words.length > 1 ? slugify(words[words.length - 1]) : "";
  if (first && last) return `${first}.${last}`;
  return first || last || `emp${slugify(employeeCode)}`;
};

// Digits only, then the last 10 (drops +91 / leading 0).
const normaliseMobile = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return { value: null, digits: 0 };
  return { value: digits.length > 10 ? digits.slice(-10) : digits, digits: digits.length };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Key used to match a person's name against Users:
 * strips "(code)", flips "Last, First", removes titles, dots and punctuation, lowercases.
 */
const personNameKey = (raw) => {
  let name = cleanText(raw).replace(/\([^)]*\)\s*$/, "");
  name = flipComma(cleanText(name)).replace(/\./g, " ");
  const words = stripTitles(
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  return words.join(" ");
};

const firstLastKey = (nameKey) => {
  const words = nameKey.split(" ").filter(Boolean);
  if (words.length < 2) return nameKey;
  return `${words[0]} ${words[words.length - 1]}`;
};

// Employee code candidates in a hierarchy cell: whole value, or the code inside brackets.
const codeCandidates = (raw) => {
  const value = cleanText(raw);
  const candidates = [value];
  const bracket = value.match(/\(([^)]+)\)\s*$/);
  if (bracket) candidates.unshift(cleanText(bracket[1]));
  return candidates.filter(Boolean);
};

/**
 * Read the first worksheet of an .xlsx buffer.
 * Header row = the row within the first 10 that matches the most known headers.
 * Returns { headerRow, ignoredColumns, missingHeaders, rows: [{ row, ...fields }] }.
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
      const text = cleanText(cell.text);
      const key = headerKey(text);
      if (key) columns.push({ col, key, text });
    });
    const matches = columns.filter((c) => c.key in HEADER_FIELDS).length;
    if (matches > best.matches) best = { rowNumber: r, matches, columns };
  }

  if (!best.matches) {
    return { headerRow: null, ignoredColumns: [], missingHeaders: Object.values(REQUIRED_HEADERS), rows: [] };
  }

  const fieldColumns = {};
  const ignoredColumns = [];
  best.columns.forEach(({ col, key, text }) => {
    const field = HEADER_FIELDS[key];
    if (field && !(field in fieldColumns)) fieldColumns[field] = col;
    else ignoredColumns.push(text);
  });

  const missingHeaders = Object.entries(REQUIRED_HEADERS)
    .filter(([field]) => !(field in fieldColumns))
    .map(([, label]) => label);

  const rows = [];
  for (let r = best.rowNumber + 1; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const record = { row: r };
    let hasValue = false;
    Object.entries(fieldColumns).forEach(([field, col]) => {
      const text = cleanText(excelRow.getCell(col).text);
      record[field] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push(record);
  }

  return { headerRow: best.rowNumber, ignoredColumns, missingHeaders, rows };
};

module.exports = {
  parseEmployeeWorkbook,
  splitEmployeeName,
  baseUsername,
  normaliseMobile,
  normaliseEmail,
  departmentCandidates,
  personNameKey,
  firstLastKey,
  codeCandidates,
  cleanText,
  EMAIL_RE,
};
