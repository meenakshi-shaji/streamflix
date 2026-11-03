const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const accountInitials = document.getElementById("accountInitials");
const accountMessage = document.getElementById("accountMessage");

fetch("/api/me")
  .then((response) => response.json())
  .then(({ user }) => {
    if (!user) {
      window.location.replace("/login.html");
      return;
    }
    accountName.textContent = user.name;
    accountEmail.textContent = user.email;
    accountInitials.textContent = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  })
  .catch(() => {
    accountName.textContent = "Could not load your account";
    accountMessage.textContent = "Check that the StreamFlix server is running, then reload this page.";
    accountMessage.classList.add("error");
  });

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" });
  } finally {
    window.location.assign("/login.html");
  }
});
