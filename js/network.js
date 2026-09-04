const Network = {
  socket: null,
  id: null,          // your player id inside a room (new every time you join)
  userId: null,      // your permanent 6-letter player ID (saved in this browser), used for invites
  room: "",
  connected: false,  // true while you are in a room
  online: false,     // true while the socket to the server is open
  onMessage: null,
  _reconnectTimer: null,

  // Load or invent the permanent player ID. Letters and digits that are hard to confuse.
  loadUserId() {
    try { this.userId = localStorage.getItem("trapocalypse.userId"); } catch (error) { /* ignore */ }
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(this.userId || "")) {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      this.userId = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      this.saveUserId();
    }
    return this.userId;
  },
  saveUserId() { try { localStorage.setItem("trapocalypse.userId", this.userId); } catch (error) { /* ignore */ } },

  // Open the connection as soon as the page loads, so invites can reach you on the menu.
  // Returns a promise that resolves once the socket is open.
  ensure() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) return this._opening;
    if (location.protocol === "file:") {
      if (this.onMessage) this.onMessage({ type: "error", message: "Start the online server, then open http://localhost:8080." });
      return Promise.reject(new Error("file"));
    }
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const sock = new WebSocket(`${protocol}://${location.host}`);
    this.socket = sock;
    this._opening = new Promise((resolve, reject) => {
      // Each listener checks it still belongs to the current socket, so an old
      // connection we deliberately dropped can't fire "Connection lost." later.
      sock.addEventListener("open", () => {
        if (this.socket !== sock) return;
        this.online = true;
        sock.send(JSON.stringify({ type: "hello", userId: this.userId }));
        resolve();
      });
      sock.addEventListener("message", (event) => {
        if (this.socket !== sock) return;
        const message = JSON.parse(event.data);
        if (message.type === "hello_ok" && message.userId !== this.userId) { this.userId = message.userId; this.saveUserId(); }
        if (message.type === "joined") { this.id = message.id; this.connected = true; }
        if (message.type === "room_state") this.room = message.code;
        if (this.onMessage) this.onMessage(message);
      });
      sock.addEventListener("close", () => {
        if (this.socket !== sock) return;
        const wasInRoom = this.connected;
        this.online = false; this.connected = false; this.socket = null;
        if (this.onMessage) this.onMessage(wasInRoom ? { type: "error", message: "Connection lost.", fatal: true } : { type: "offline" });
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this.ensure().catch(() => {}), 3000);   // keep trying quietly
        reject(new Error("closed"));
      });
      sock.addEventListener("error", () => { /* the close event follows and handles it */ });
    });
    return this._opening;
  },

  // Create or join a room. settings: only used when creating.
  connect(name, code = "", settings = null) {
    this.ensure().then(() => {
      this.send({ type: code ? "join_room" : "create_room", name, code, settings });
    }).catch(() => {
      if (this.onMessage) this.onMessage({ type: "error", message: "Could not connect to the game server.", fatal: true });
    });
  },

  // Leave the room but stay connected to the server (so invites still reach you).
  leave() {
    this.send({ type: "leave_room" });
    this.connected = false;
    this.id = null;
    this.room = "";
  },

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  },
};
