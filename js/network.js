const Network = {
  socket: null,
  id: null,
  room: "",
  connected: false,
  onMessage: null,

  // settings: the host's match settings, only used when creating a room.
  connect(name, code = "", settings = null) {
    if (location.protocol === "file:") {
      if (this.onMessage) this.onMessage({ type: "error", message: "Start the online server, then open http://localhost:8080." });
      return;
    }
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const sock = new WebSocket(`${protocol}://${location.host}`);
    this.socket = sock;
    // Each listener checks it still belongs to the current socket, so an old
    // connection we deliberately closed can't fire "Connection lost." later.
    sock.addEventListener("open", () => {
      if (this.socket !== sock) return;
      sock.send(JSON.stringify({ type: code ? "join_room" : "create_room", name, code, settings }));
    });
    sock.addEventListener("message", (event) => {
      if (this.socket !== sock) return;
      const message = JSON.parse(event.data);
      if (message.type === "joined") { this.id = message.id; this.connected = true; }
      if (message.type === "room_state") this.room = message.code;
      if (this.onMessage) this.onMessage(message);
    });
    sock.addEventListener("close", () => { if (this.socket !== sock) return; this.connected = false; if (this.onMessage) this.onMessage({ type: "error", message: "Connection lost.", fatal: true }); });
    sock.addEventListener("error", () => { if (this.socket !== sock) return; if (this.onMessage) this.onMessage({ type: "error", message: "Could not connect to the game server.", fatal: true }); });
  },

  // Leave on purpose: tell the server, then drop the socket so its events are ignored.
  leave() {
    this.send({ type: "leave_room" });
    const old = this.socket;
    this.socket = null;
    this.connected = false;
    this.id = null;
    this.room = "";
    if (old) old.close();
  },

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  },
};
