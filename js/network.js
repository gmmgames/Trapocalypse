const Network = {
  socket: null,
  id: null,
  room: "",
  connected: false,
  onMessage: null,

  connect(name, code = "") {
    if (location.protocol === "file:") {
      if (this.onMessage) this.onMessage({ type: "error", message: "Start the online server, then open http://localhost:8080." });
      return;
    }
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    this.socket = new WebSocket(`${protocol}://${location.host}`);
    this.socket.addEventListener("open", () => {
      this.socket.send(JSON.stringify({ type: code ? "join_room" : "create_room", name, code }));
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "joined") { this.id = message.id; this.connected = true; }
      if (message.type === "room_state") this.room = message.code;
      if (this.onMessage) this.onMessage(message);
    });
    this.socket.addEventListener("close", () => { this.connected = false; if (this.onMessage) this.onMessage({ type: "error", message: "Connection lost." }); });
    this.socket.addEventListener("error", () => { if (this.onMessage) this.onMessage({ type: "error", message: "Could not connect to the game server." }); });
  },

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  },
};
