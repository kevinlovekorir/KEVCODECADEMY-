// Shared header/footer behavior. Include on every page after auth.js is loaded.
import { watchAuth, logOut } from "./auth.js";

export function initNav(activePath){
  document.querySelectorAll(`.nav-links a[href="${activePath}"], .mobile-menu a[href="${activePath}"]`)
    .forEach(a => a.classList.add("active"));

  const hamburger = document.querySelector(".hamburger");
  const mobileMenu = document.querySelector(".mobile-menu");
  if (hamburger && mobileMenu){
    hamburger.addEventListener("click", () => mobileMenu.classList.toggle("open"));
  }

  const authSlot = document.querySelector("[data-auth-slot]");
  if (authSlot){
    watchAuth((user, profile) => {
      if (!user){
        authSlot.innerHTML = `
          <a class="btn btn-ghost btn-sm" href="/login.html">Log In</a>
          <a class="btn btn-primary btn-sm" href="/signup.html">Sign Up</a>`;
        return;
      }
      const initial = (profile?.name || user.email || "?").trim().charAt(0).toUpperCase();
      authSlot.innerHTML = `
        <a class="user-chip" href="/dashboard.html">
          <span class="avatar">${initial}</span>
          <span>${profile?.name || "Dashboard"}</span>
        </a>
        <button class="btn btn-ghost btn-sm" id="logout-btn">Log Out</button>`;
      document.getElementById("logout-btn")?.addEventListener("click", async () => {
        await logOut();
        window.location.href = "/index.html";
      });
    });
  }
}
