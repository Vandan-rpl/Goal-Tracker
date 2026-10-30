/**
 * Text formatting shared by the idea service (activity log remarks) and the
 * idea emails, so both show days and dates the same way.
 */

const pluralDays = (days) => `${days} day${days === 1 ? "" : "s"}`;

// SQL DATE value (a JS Date at UTC midnight) as DD/MM/YYYY
const formatDate = (value) => {
    if (!value) return "";
    const [year, month, day] = new Date(value).toISOString().slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
};

module.exports = { pluralDays, formatDate };
