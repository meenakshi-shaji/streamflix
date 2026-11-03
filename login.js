const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const loginEmailError = document.getElementById("loginEmailError");
const loginPasswordError = document.getElementById("loginPasswordError");
const submitButton = loginForm.querySelector("[type=submit]");

function clearLoginMessage() {
  loginMessage.textContent = "";
  loginMessage.className = "form-message";
}

function setLoginError(input, element, message) {
  element.textContent = message;
  input.setAttribute("aria-invalid", String(Boolean(message)));
}

document.getElementById("toggleLoginPassword").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const showing = loginPassword.type === "password";
  loginPassword.type = showing ? "text" : "password";
  button.textContent = showing ? "Hide" : "Show";
  button.setAttribute("aria-label", showing ? "Hide password" : "Show password");
  button.setAttribute("aria-pressed", String(showing));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginMessage();
  setLoginError(loginEmail, loginEmailError, "");
  setLoginError(loginPassword, loginPasswordError, "");
  let firstInvalid = null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.value.trim())) {
    setLoginError(loginEmail, loginEmailError, "Enter a valid email address.");
    firstInvalid = loginEmail;
  }
  if (!loginPassword.value) {
    setLoginError(loginPassword, loginPasswordError, "Enter your password.");
    firstInvalid ||= loginPassword;
  }
  if (firstInvalid) {
    loginMessage.textContent = "Check the highlighted fields and try again.";
    loginMessage.classList.add("error");
    firstInvalid.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.firstChild.textContent = "Signing in… ";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail.value.trim(), password: loginPassword.value }),
    });
    const result = await response.json();
    if (!response.ok) {
      loginMessage.textContent = result.error || "We couldn’t sign you in. Please try again.";
      loginMessage.classList.add("error");
      return;
    }
    window.location.assign("/account.html");
  } catch {
    loginMessage.textContent = "Could not reach the StreamFlix server. Check that it is running and try again.";
    loginMessage.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.firstChild.textContent = "Sign in ";
  }
});

loginEmail.addEventListener("input", () => setLoginError(loginEmail, loginEmailError, ""));
loginPassword.addEventListener("input", () => setLoginError(loginPassword, loginPasswordError, ""));

document.getElementById("forgotPassword").addEventListener("click", () => {
  clearLoginMessage();
  loginMessage.textContent = "Password reset email isn’t configured for this local backend yet.";
  loginMessage.classList.add("success");
});

fetch("/api/me").then((response) => response.json()).then((result) => {
  if (result.user) window.location.replace("/account.html");
}).catch(() => {});
