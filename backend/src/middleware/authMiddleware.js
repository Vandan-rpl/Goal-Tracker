const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

// Low-level decode, shared by the Express middleware below AND the
// Socket.IO handshake authentication set up in server.js, so both paths
// verify tokens exactly the same way against exactly the same secret.
const decodeAuthToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided or invalid format.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = decodeAuthToken(token); // Contains UserId, Username, RoleId, IsFirstLogin, etc.
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.',
            errors: error.message
        });
    }
};

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
    verifyRole,
    decodeAuthToken
};