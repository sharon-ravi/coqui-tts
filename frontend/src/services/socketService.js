// frontend/src/services/socketService.js
const WEBSOCKET_URL = "ws://localhost:8000/tts-stream";
let socket = null;
let onMessageHandler = () => {};

const socketService = {
  connect: () => {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    socket = new WebSocket(WEBSOCKET_URL);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => console.log("CLIENT: WebSocket connection established.");
    socket.onclose = () => {
        console.log("CLIENT: WebSocket connection closed.");
        socket = null; // Ensure we can reconnect
    };
    socket.onerror = (error) => console.error("CLIENT: WebSocket Error:", error);
    socket.onmessage = (event) => onMessageHandler(event.data);
  },
  sendMessage: (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  },
  setOnMessageHandler: (handler) => {
    onMessageHandler = handler;
  },
  isConnected: () => socket && socket.readyState === WebSocket.OPEN,
};

export default socketService;