const jwt = require('jsonwebtoken');
const { poolPromise, sql } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

// Error code the frontend looks for to send the user to the forced
// password change screen (see frontend/src/api/axios.js).
const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

const toBool = (value) => value === true || value === 1 || value === "1";

// Low-level decode, shared by the Express middleware below AND the
// Socket.IO handshake authentication set up in server.js, so both paths
// verify tokens exactly the same way against exactly the same secret.
const decodeAuthToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

// Reads the user's current account state from the DB. The JWT is issued at
// login and lives for 8h, so its claims go stale the moment the password is
// changed (or reset to a temporary one) — the DB is the source of truth.
// Returns null when the user no longer exists or is inactive.
const getAccountState = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('UserID', sql.Int, userId)
        .query('SELECT DefaultPasswordFlag FROM Users WHERE UserID = @UserID AND IsActive = 1');

    if (result.recordset.length === 0) return null;

    return { mustChangePassword: toBool(result.recordset[0].DefaultPasswordFlag) };
};

// allowPasswordChangeRequired: true only for the endpoint that performs the
// forced change itself; every other protected route rejects a user who is
// still on a temporary password (DefaultPasswordFlag = 1).
const authenticate = ({ allowPasswordChangeRequired = false } = {}) => async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided or invalid format.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = decodeAuthToken(token); // { userId, username, role, isPasswordChanged, iat, exp }
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.',
            errors: error.message
        });
    }

    try {
        const account = await getAccountState(req.user.userId);

        if (!account) {
            return res.status(401).json({
                success: false,
                message: 'Your account is no longer active. Please contact admin.'
            });
        }

        if (account.mustChangePassword && !allowPasswordChangeRequired) {
            return res.status(403).json({
                success: false,
                code: PASSWORD_CHANGE_REQUIRED,
                message: 'You must change your temporary password before continuing.'
            });
        }

        next();
    } catch (error) {
        console.error('Auth account check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication.'
        });
    }
};

const verifyToken = authenticate();

// Only for the forced password change endpoint.
const verifyTokenForPasswordChange = authenticate({ allowPasswordChangeRequired: true });

const verifyRole = (requiredRoles) => {
    return (req, res, next) => {
        if (!req.user || !requiredRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access. Insufficient privileges.'
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    verifyTokenForPasswordChange,
    verifyRole,
    decodeAuthToken,
    getAccountState,
    PASSWORD_CHANGE_REQUIRED
};
