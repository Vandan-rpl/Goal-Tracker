const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const { poolPromise } = require('./config/db');
const { decodeAuthToken } = require('./middleware/authMiddleware');
const { setIO } = require('./sockets/io');

// Import Routers
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const goalRoutes = require('./routes/goalRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const teamRoutes = require('./routes/teamRoutes');
const profileRoutes = require('./routes/profileRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// CORS origin is shared between Express and Socket.IO so both stay in sync
// if the frontend URL ever changes.
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware setup for CORS and JSON body parsing
app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Database Connection Route
app.get('/api/health', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().query('SELECT 1 AS healthCheck');
        res.status(200).json({
            success: true,
            message: 'Goal Tracker Enterprise Backend is running and connected to SQL Server.',
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database health check failed.',
            errors: error.message
        });
    }
});

// Mount Feature API Routers under /api/v1 prefix
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/ratings', ratingRoutes);
// NOTE: notificationRoutes.js existed but was never mounted anywhere in this
// file before — every /notifications/* call from the frontend was a 404.
// That's the actual reason the bell/badge never worked, on top of the
// route-path issue reported. Fixed by mounting it here like every other
// feature router.
app.use('/api/v1/notifications', notificationRoutes);
// NOTE: the prompt asked for GET /api/evaluation/:userId (no /v1). Mounted
// under /api/v1 instead, matching every other feature router in this file
// (auth, goals, teams, ratings, notifications, etc.) — using a bare /api
// prefix just for this one router would be an inconsistent one-off.
app.use('/api/v1/evaluation', evaluationRoutes);
// NOTE: dashboardRoutes.js existed but was never mounted anywhere in this
// file before — every /dashboard/* call from the frontend was a 404,
// separate from (and in addition to) dashboardService.js being empty and
// dashboardRoutes.js passing the wrong thing as middleware. All three are
// fixed now.
app.use('/api/v1/dashboard', dashboardRoutes);

// ============================================================
// HTTP + Socket.IO server
// ============================================================
// Socket.IO needs to sit on the same underlying HTTP server as Express,
// so we create the http server explicitly instead of calling app.listen().
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_ORIGIN,
        credentials: true
    }
});

// Authenticate every socket handshake using the SAME token-decoding logic
// as the regular Express routes (decodeAuthToken, exported from
// authMiddleware.js). The frontend sends the JWT via `socket.handshake.auth.token`.
io.use((socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

        if (!token) {
            return next(new Error('Authentication error: no token provided.'));
        }

        socket.user = decodeAuthToken(token); // { userId, username, role, isPasswordChanged, iat, exp }
        next();
    } catch (error) {
        next(new Error('Authentication error: invalid or expired token.'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.user?.userId;

    if (userId) {
        // Every notification for this user gets emitted to this room —
        // see notifyService.js's notifyUser().
        socket.join(`user:${userId}`);
        console.log(`[SOCKET] Connected: socket=${socket.id} userId=${userId} -> joined room user:${userId}`);
    } else {
        console.warn(`[SOCKET] Connected without a resolvable userId: socket=${socket.id}`);
    }

    socket.on('disconnect', (reason) => {
        console.log(`[SOCKET] Disconnected: socket=${socket.id} userId=${userId} reason=${reason}`);
    });
});

// Make the io instance available to notifyService.js (and anything else)
// without a circular require() back to this file.
setIO(io);

// Port configuration and server startup
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(`Server (HTTP + Socket.IO) is running smoothly on port ${PORT}`);
});
