# StreamFlix

StreamFlix is a small Node.js app with local account registration and sign-in. It uses only Node's built-in modules.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `node serve.cjs`.
3. Open `http://localhost:8000`.

Set `PORT` to use another port. Account records are stored in `.streamflix-data/users.json`; passwords are stored as salted scrypt hashes. The data folder is excluded from Git and is not served by the app. Sign-in sessions are held in memory, so restarting the server signs everyone out while keeping their accounts.

## Account routes

- `POST /api/signup` creates an account and starts a session.
- `POST /api/login` checks an account and starts a session.
- `GET /api/me` returns the signed-in user's name and email.
- `POST /api/logout` ends the current session.

Password reset email and streaming playback are not connected yet. This server is intended for local development, not public production hosting.
