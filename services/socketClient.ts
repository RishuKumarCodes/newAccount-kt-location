// native/src/services/socketClient.ts
import { io } from "socket.io-client";

// use your backend ngrok/render URL
const SOCKET_URL = "https://your-backend-url.ngrok-free.app";

let socket: any = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
    });
    socket.on("connect", () => console.log("🟢 Socket connected:", socket.id));
    socket.on("disconnect", () => console.log("🔴 Socket disconnected"));
  }
  return socket;
};
