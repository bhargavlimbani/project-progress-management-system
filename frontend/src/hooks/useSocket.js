import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BASE_URL } from "../services/api.js";

/**
 * One shared Socket.IO connection for the whole app.
 *
 * The token is sent in the handshake `auth` payload — the server verifies it
 * and derives identity from there, so the client never asserts who it is.
 */
let sharedSocket = null;
let refCount = 0;

function socketOrigin() {
  // BASE_URL points at /api; the socket lives at the server root.
  return BASE_URL.replace(/\/api\/?$/, "");
}

export function useSocket() {
  const [socket, setSocket] = useState(sharedSocket);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const token = localStorage.getItem("sapms_token");
    if (!token) return undefined;

    if (!sharedSocket) {
      sharedSocket = io(socketOrigin(), {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
      });

      sharedSocket.on("connect_error", (err) => {
        // Auth failures are expected right after logout — don't spam the console.
        if (!String(err.message).includes("Authentication")) {
          console.warn("Socket connection error:", err.message);
        }
      });
    }

    refCount += 1;
    if (mounted.current) setSocket(sharedSocket);

    return () => {
      mounted.current = false;
      refCount -= 1;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, []);

  return socket;
}

/** Tear the shared socket down on logout so the next login re-authenticates. */
export function closeSocket() {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    refCount = 0;
  }
}
