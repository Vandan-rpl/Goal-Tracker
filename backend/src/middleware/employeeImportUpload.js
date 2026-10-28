const multer = require('multer');
const path = require('path');

// HR employee import: keep the file in memory (exceljs reads the buffer directly),
// accept .xlsx only, 20 MB limit (HR's full export has 200+ columns).
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.xlsx') {
            cb(null, true);
        } else {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'), false);
        }
    },
    limits: { fileSize: 20 * 1024 * 1024 }
}).single('file');

// Turn multer errors into 400 responses instead of falling through to a 500.
const employeeImportUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large. Maximum size is 20 MB.'
            : err.code === 'LIMIT_UNEXPECTED_FILE'
                ? "Only .xlsx files are allowed, uploaded in the 'file' field."
                : err.message || 'File upload failed.';
        return res.status(400).json({ success: false, message });
    });
};

module.exports = employeeImportUpload;
