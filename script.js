const signupForm = document.getElementById("signupForm");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const password = document.getElementById("password");
const terms = document.getElementById("terms");
const togglePassword = document.getElementById("togglePassword");
const formMessage = document.getElementById("formMessage");
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const termsError = document.getElementById("termsError");

function setError(input, element, message) {
  element.textContent = message;
  input.setAttribute("aria-invalid", String(Boolean(message)));
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

togglePassword.addEventListener("click", () => {
  const showing = password.type === "password";
  password.type = showing ? "text" : "password";
  togglePassword.textContent = showing ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", showing ? "Hide password" : "Show password");
  togglePassword.setAttribute("aria-pressed", String(showing));
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  setError(fullName, nameError, "");
  setError(email, emailError, "");
  setError(password, passwordError, "");
  termsError.textContent = "";
  terms.removeAttribute("aria-invalid");

  let firstInvalid = null;
  if (fullName.value.trim().length < 2) {
    setError(fullName, nameError, "Please enter a name with at least 2 characters.");
    firstInvalid = fullName;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    setError(email, emailError, "Please enter a valid email address.");
    firstInvalid ||= email;
  }
  if (password.value.length < 8) {
    setError(password, passwordError, "Your password must contain at least 8 characters.");
    firstInvalid ||= password;
  }
  if (!terms.checked) {
    termsError.textContent = "Please agree to the terms before continuing.";
    terms.setAttribute("aria-invalid", "true");
    firstInvalid ||= terms;
  }
  if (firstInvalid) {
    formMessage.textContent = "Please correct the highlighted fields and try again.";
    formMessage.classList.add("error");
    firstInvalid.focus();
    return;
  }

  const submit = signupForm.querySelector("[type=submit]");
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  submit.firstChild.textContent = "Creating account… ";
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName.value.trim(), email: email.value.trim(), password: password.value, termsAccepted: terms.checked }),
    });
    const result = await response.json();
    if (!response.ok) {
      const fields = { fullName: [fullName, nameError], email: [email, emailError], password: [password, passwordError], terms: [terms, termsError] };
      if (result.field && fields[result.field]) {
        const [input, element] = fields[result.field];
        if (input === terms) input.setAttribute("aria-invalid", "true");
        else setError(input, element, result.error);
        input.focus();
      }
      formMessage.textContent = result.error || "We couldn’t create your account. Please try again.";
      formMessage.classList.add("error");
      return;
    }
    window.location.assign("/account.html");
  } catch {
    formMessage.textContent = "Could not reach the StreamFlix server. Check that it is running and try again.";
    formMessage.classList.add("error");
  } finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
    submit.firstChild.textContent = "Create account ";
  }
});

fullName.addEventListener("input", () => setError(fullName, nameError, ""));
email.addEventListener("input", () => setError(email, emailError, ""));
password.addEventListener("input", () => setError(password, passwordError, ""));
terms.addEventListener("change", () => {
  termsError.textContent = "";
  terms.removeAttribute("aria-invalid");
});
