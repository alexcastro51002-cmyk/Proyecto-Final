const API_BASE = "https://portfolio-api-three-black.vercel.app/api/v1";
const qs = (s) => document.querySelector(s);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const strip = (s) =>
  (s == null ? "" : String(s)).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const setMsg = (text, ok = false) => {
  const el = qs("#msg");
  if (el) {
    el.textContent = strip(text || "");
    el.style.color = ok ? "#22c55e" : "#94a3b8";
  }
};
const saveToken = (t) => localStorage.setItem("authToken", t);
const getToken = () => localStorage.getItem("authToken");
const saveUser = (u) => localStorage.setItem("authUser", JSON.stringify(u));
const getUser = () => {
  const u = localStorage.getItem("authUser");
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};
const clearAuth = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
};

async function api(path, opts = {}) {
  const token = getToken();
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  if (opts.auth) headers["auth-token"] = token || "";
  const res = await fetch(
    `${API_BASE}${path}`,
    Object.assign({}, opts, { headers })
  );
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg =
      data && (data.message || data.error)
        ? data.message || data.error
        : "Solicitud fallida";
    throw new Error(strip(msg));
  }
  return data;
}

async function handleRegister() {
  const form = qs("#register-form");
  if (!form) return;
  if (getToken()) {
    location.href = "home.html";
    return;
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Registrando...");
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name").trim(),
      email: fd.get("email").trim(),
      itsonId: fd.get("itsonId").trim(),
      password: fd.get("password"),
    };
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMsg("Cuenta creada", true);
      setTimeout(() => (location.href = "login.html"), 700);
    } catch (err) {
      setMsg(err.message);
    }
  });
}

async function handleLogin() {
  const form = qs("#login-form");
  if (!form) return;
  if (getToken()) {
    location.href = "home.html";
    return;
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Iniciando sesion...");
    const fd = new FormData(form);
    const payload = {
      email: fd.get("email").trim(),
      password: fd.get("password"),
    };
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (data && data.token) saveToken(data.token);
      if (data && data.user) saveUser(data.user);
      location.href = "home.html";
    } catch (err) {
      setMsg(err.message);
    }
  });
}

async function requireAuth() {
  const token = getToken();
  if (!token) {
    location.href = "login.html";
    return false;
  }
  try {
    await api("/projects", { auth: true });
    return true;
  } catch {
    clearAuth();
    location.href = "login.html";
    return false;
  }
}

function parseCsv(v) {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

function resetForm() {
  qs("#form-title").textContent = "Nuevo proyecto";
  qs("#projectId").value = "";
  qs("#project-form").reset();
}

function showForm() {
  show(qs("#form-panel"));
}

function hideForm() {
  hide(qs("#form-panel"));
  resetForm();
}

async function loadProjects() {
  try {
    const data = await api("/projects", { auth: true });
    window.__projects = Array.isArray(data)
      ? data
      : data && data.projects
      ? data.projects
      : [];
    renderProjects(window.__projects);
  } catch (err) {
    setMsg(err.message);
  }
}

async function getProject(id) {
  try {
    const data = await api(`/projects/${id}`, { auth: true });
    return data && data.project ? data.project : data;
  } catch {
    return null;
  }
}

function renderProjects(list) {
  const wrap = qs("#projects-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!Array.isArray(list) || list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = "<p>Sin proyectos</p>";
    wrap.appendChild(empty);
  } else {
    list.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card";
      const techs = Array.isArray(p.technologies) ? p.technologies : [];
      const imgs = Array.isArray(p.images) ? p.images : [];
      card.innerHTML = `
        <h3>${escapeHtml(p.title || "")}</h3>
        <p>${escapeHtml(p.description || "")}</p>
        <div class="badges">${techs
          .map((t) => `<span class="badge">${escapeHtml(t)}</span>`)
          .join("")}</div>
        ${
          p.repository
            ? `<a href="${
                p.repository
              }" target="_blank" rel="noopener noreferrer" class="meta">${escapeHtml(
                p.repository
              )}</a>`
            : ""
        }
        ${
          imgs.length
            ? `<div class="badges">${imgs
                .slice(0, 3)
                .map((u) => `<span class="badge">img</span>`)
                .join("")}</div>`
            : ""
        }
        <div class="card-actions">
          <button class="btn ghost" data-edit="${p._id}">Editar</button>
          <button class="btn danger" data-del="${p._id}">Eliminar</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }
  wrap.onclick = async (e) => {
    const id = e.target.getAttribute("data-del");
    const eid = e.target.getAttribute("data-edit");
    if (id) {
      try {
        await api(`/projects/${id}`, { method: "DELETE", auth: true });
        await loadProjects();
        setMsg("Eliminado", true);
      } catch (err) {
        setMsg(err.message);
      }
    }
    if (eid) {
      await enterEditMode(eid);
    }
  };
}

async function enterEditMode(id) {
  let proj =
    (window.__projects || []).find((x) => x._id === id) ||
    (await getProject(id));
  if (!proj) return;
  showForm();
  qs("#form-title").textContent = "Editar proyecto";
  qs("#projectId").value = proj._id || "";
  qs("#title").value = proj.title || "";
  qs("#description").value = proj.description || "";
  qs("#technologies").value = Array.isArray(proj.technologies)
    ? proj.technologies.join(", ")
    : "";
  qs("#repository").value = proj.repository || "";
  qs("#images").value = Array.isArray(proj.images)
    ? proj.images.join(", ")
    : "";
}

async function handleHome() {
  if (!qs(".home")) return;
  const ok = await requireAuth();
  if (!ok) return;
  await loadProjects();
  const add = qs("#btn-add");
  const logout = qs("#btn-logout");
  const cancel = qs("#btn-cancel");
  const form = qs("#project-form");
  add.addEventListener("click", () => {
    showForm();
    setMsg("");
  });
  cancel.addEventListener("click", () => {
    hideForm();
    setMsg("");
  });
  logout.addEventListener("click", () => {
    clearAuth();
    location.href = "login.html";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Guardando...");
    const fd = new FormData(form);
    const id = fd.get("projectId");
    const payload = {
      title: fd.get("title").trim(),
      description: fd.get("description").trim(),
      technologies: parseCsv(fd.get("technologies")),
      repository: fd.get("repository").trim() || undefined,
      images: parseCsv(fd.get("images")),
    };
    try {
      if (id) {
        await api(`/projects/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          auth: true,
        });
        setMsg("Actualizado", true);
      } else {
        await api("/projects", {
          method: "POST",
          body: JSON.stringify(payload),
          auth: true,
        });
        setMsg("Creado", true);
      }
      hideForm();
      await loadProjects();
    } catch (err) {
      setMsg(err.message);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const itson = document.getElementById("itsonId");
  if (itson) {
    itson.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });
  }
  handleRegister();
  handleLogin();
  handleHome();
});
