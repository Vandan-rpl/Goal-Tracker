// Small singleton so any file (e.g. notifyService.js) can grab the live
// Socket.IO server instance without creating a circular require() back to
// server.js (which is what sets it, right after creating the io server).
let ioInstance = null;

const setIO = (io) => {
    ioInstance = io;
};

const getIO = () => ioInstance;

module.exports = { setIO, getIO };
