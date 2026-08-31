import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { notificationReceived } from "../redux/slices/notificationSlice";

// Same host the REST API lives on (see src/api/axios.js), but WITHOUT the
// /api/v1 path — Socket.IO manages its own path (/socket.io) on top of the
// plain origin.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// Kept at module scope (not in the hook's closure) so remounts of whatever
// component calls useSocket() — including React 18 StrictMode's
// mount/unmount/mount in dev — reuse the same connection instead of piling
// up duplicate sockets.
let socket = null;

/**
 * Connects once (per browser tab) to the backend's Socket.IO server using
 * the same JWT already used for REST calls, joins nothing manually — the
 * backend puts this socket in a `user:${userId}` room itself right after
 * verifying the handshake token — and wires 'notification:new' straight
 * into Redux + a short sound.
 *
 * Call this once from somewhere that's always mounted while the user is
 * logged in (this app calls it from layouts/DashboardLayout.jsx).
 */
const useSocket = () => {
  const dispatch = useDispatch();
  const audioRef = useRef(null);

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");

    // Not logged in (or logged out) — nothing to connect to yet.
    if (!token) {
      return undefined;
    }

    if (!socket) {
      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
      });
    }

    // Lazily create the <audio> element once; browsers require at least one
    // prior user gesture on the page before autoplay is allowed, so the
    // very first notification right after login may play silently — that's
    // a browser policy, not a bug here.
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification-ding.wav");
    }

    const handleConnectError = (err) => {
      console.error("[socket] connection error:", err.message);
    };

    const handleNewNotification = (notification) => {
      dispatch(notificationReceived(notification));
      audioRef.current?.play().catch(() => {
        // Autoplay blocked until the user interacts with the page — ignore.
      });
    };

    socket.on("connect_error", handleConnectError);
    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("connect_error", handleConnectError);
      socket.off("notification:new", handleNewNotification);
    };
  }, [dispatch]);
};

export default useSocket;
