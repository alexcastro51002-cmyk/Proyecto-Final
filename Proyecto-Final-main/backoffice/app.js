const API_BASE = "https://portfolio-api-three-black.vercel.app/api/v1";

const qs = (s) => document.querySelector(s);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const strip = (s) =>
  (s == null ? "" : String(s)).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
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
const clearAuth = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
};

function parseCsv(v) {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function requireAuth() {
  const token = getToken();
  if (!token) {
    location.href = "login.html";
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: { "auth-token": token },
    });
    if (!res.ok) throw new Error();
    return true;
  } catch {
    clearAuth();
    location.href = "login.html";
    return false;
  }
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
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
      if (data && data.token) saveToken(data.token);
      if (data && data.user) saveUser(data.user);
      location.href = "home.html";
    } catch (err) {
      setMsg(err.message);
    }
  });
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

function renderProjects(list) {
  const wrap = qs("#projects-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!Array.isArray(list) || list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = "<p>Sin proyectos</p>";
    wrap.appendChild(empty);
    return;
  }
  list.forEach((p) => {
    const techs = Array.isArray(p.technologies) ? p.technologies : [];
    const imgs = Array.isArray(p.images) ? p.images : [];
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${
        imgs[0]
          ? `<img src="${escapeHtml(
              imgs[0]
            )}" alt="preview" style="width:100%;height:140px;object-fit:cover;border-radius:.6rem;border:1px solid rgba(255,255,255,.1)">`
          : ""
      }
      <h3>${escapeHtml(p.title || "")}</h3>
      <p>${escapeHtml(p.description || "")}</p>
      <div class="badges">${techs
        .map((t) => `<span class="badge">${escapeHtml(t)}</span>`)
        .join("")}</div>
      <div class="card-actions">
        <button class="btn ghost" data-edit="${p._id}">Editar</button>
        <button class="btn danger" data-del="${p._id}">Eliminar</button>
      </div>
    `;
    wrap.appendChild(card);
  });
  wrap.onclick = async (e) => {
    const idDel = e.target.getAttribute("data-del");
    const idEdit = e.target.getAttribute("data-edit");
    if (idDel) {
      try {
        const res = await fetch(`${API_BASE}/projects/${idDel}`, {
          method: "DELETE",
          headers: { "auth-token": getToken() || "" },
        });
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
        await loadProjects();
        setMsg("Eliminado", true);
      } catch (err) {
        setMsg(err.message);
      }
    }
    if (idEdit) {
      await enterEditMode(idEdit);
    }
  };
}

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: { "auth-token": getToken() || "" },
    });
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
    const list = Array.isArray(data)
      ? data
      : data && data.projects
      ? data.projects
      : [];
    window.__projects = list;
    renderProjects(list);
  } catch (err) {
    setMsg(err.message);
  }
}

async function enterEditMode(id) {
  let proj = (window.__projects || []).find((x) => x._id === id);
  if (!proj) {
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        headers: { "auth-token": getToken() || "" },
      });
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
      proj = data && data.project ? data.project : data;
    } catch {
      proj = null;
    }
  }
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
  const cancel = qs("#btn-cancel");
  const logout = qs("#btn-logout");
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
        const res = await fetch(`${API_BASE}/projects/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "auth-token": getToken() || "",
          },
          body: JSON.stringify(payload),
        });
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
        setMsg("Actualizado", true);
      } else {
        const res = await fetch(`${API_BASE}/projects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": getToken() || "",
          },
          body: JSON.stringify(payload),
        });
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
