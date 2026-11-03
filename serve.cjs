const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, ".streamflix-data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const publicFiles = new Set([
  "index.html", "login.html", "account.html", "style.css",
  "script.js", "login.js", "account.js",
]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

let writeQueue = Promise.resolve();
const attempts = new Map();

async function readUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function saveUsers(users) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${USERS_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(users, null, 2), { mode: 0o600 });
    await fs.rename(tempFile, USERS_FILE);
  });
  return writeQueue;
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function currentUser(request) {
  const token = parseCookies(request.headers.cookie).streamflix_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL;
  return session.user;
}

function setSession(response, user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `streamflix_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`);
}

function clearSession(request, response) {
  const token = parseCookies(request.headers.cookie).streamflix_session;
  if (token) sessions.delete(token);
  response.setHeader("Set-Cookie", "streamflix_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16_384) throw Object.assign(new Error("Request is too large."), { status: 413 });
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw Object.assign(new Error("Request must contain valid JSON."), { status: 400 });
  }
}

function tooManyAttempts(request) {
  const address = request.socket.remoteAddress || "unknown";
  const entry = attempts.get(address);
  if (!entry || entry.resetAt <= Date.now()) {
    attempts.set(address, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

async function api(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/me") {
    const user = currentUser(request);
    return sendJson(response, 200, { user: user ? { name: user.name, email: user.email } : null });
  }

  if (request.method === "POST" && pathname === "/api/logout") {
    clearSession(request, response);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method !== "POST" || !["/api/signup", "/api/login"].includes(pathname)) {
    return sendJson(response, 404, { error: "Not found." });
  }

  const origin = request.headers.origin;
  if (origin && new URL(origin).host !== request.headers.host) {
    return sendJson(response, 403, { error: "Request origin was rejected." });
  }
  if (!String(request.headers["content-type"] || "").includes("application/json")) {
    return sendJson(response, 415, { error: "Expected a JSON request." });
  }
  if (tooManyAttempts(request)) {
    return sendJson(response, 429, { error: "Too many attempts. Please wait 15 minutes and try again." });
  }

  const body = await readBody(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

  if (pathname === "/api/signup") {
    const name = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (name.length < 2 || name.length > 80) return sendJson(response, 400, { field: "fullName", error: "Enter a name between 2 and 80 characters." });
    if (!emailIsValid) return sendJson(response, 400, { field: "email", error: "Enter a valid email address." });
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 128) return sendJson(response, 400, { field: "password", error: "Use a password between 8 and 128 bytes." });
    if (body.termsAccepted !== true) return sendJson(response, 400, { field: "terms", error: "Please agree to the terms before continuing." });

    const users = await readUsers();
    if (users.some((user) => user.email === email)) return sendJson(response, 409, { field: "email", error: "An account with this email already exists. Try signing in." });
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    const user = { id: crypto.randomUUID(), name, email, salt, passwordHash: hash.toString("hex"), createdAt: new Date().toISOString() };
    users.push(user);
    await saveUsers(users);
    setSession(response, { id: user.id, name: user.name, email: user.email });
    return sendJson(response, 201, { user: { name: user.name, email: user.email } });
  }

  if (!emailIsValid || password.length === 0 || Buffer.byteLength(password, "utf8") > 128) {
    return sendJson(response, 400, { error: "Enter a valid email address and password." });
  }
  const user = (await readUsers()).find((entry) => entry.email === email);
  if (!user) return sendJson(response, 401, { error: "Email or password is incorrect." });
  const candidate = await scrypt(password, user.salt, 64);
  const savedHash = Buffer.from(user.passwordHash, "hex");
  if (candidate.length !== savedHash.length || !crypto.timingSafeEqual(candidate, savedHash)) {
    return sendJson(response, 401, { error: "Email or password is incorrect." });
  }
  setSession(response, { id: user.id, name: user.name, email: user.email });
  return sendJson(response, 200, { user: { name: user.name, email: user.email } });
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  const pathname = new URL(request.url, "http://localhost").pathname;

  try {
    if (pathname.startsWith("/api/")) return await api(request, response, pathname);

    if (pathname === "/account.html" && !currentUser(request)) {
      response.writeHead(302, { Location: "/login.html" }).end();
      return;
    }

    const name = pathname === "/" ? "index.html" : pathname.slice(1);
    if (!publicFiles.has(name)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    const content = await fs.readFile(path.join(ROOT, name));
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(name)] });
    response.end(content);
  } catch (error) {
    if (response.headersSent) return response.destroy();
    const status = error.status || 500;
    if (status === 500) console.error(error);
    sendJson(response, status, { error: status === 500 ? "Something went wrong. Please try again." : error.message });
  }
});

server.listen(Number(process.env.PORT) || 8000, "127.0.0.1", () => {
  console.log(`StreamFlix backend running at http://localhost:${server.address().port}`);
});
