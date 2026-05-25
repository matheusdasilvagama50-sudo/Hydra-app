const authModal = document.getElementById("authModal");
const openLogin = document.getElementById("openLogin");
const openCheckout = document.getElementById("openCheckout");
const startNow = document.getElementById("startNow");
const scrollPlans = document.getElementById("scrollPlans");
const authTitle = document.getElementById("authTitle");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const ticketForm = document.getElementById("ticketForm");
const sendMsgBtn = document.getElementById("sendMsgBtn");
const messages = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const dashText = document.getElementById("dashText");
const statusText = document.getElementById("statusText");

const botName = document.getElementById("botName");
const welcome = document.getElementById("welcome");
const tone = document.getElementById("tone");

const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userPass = document.getElementById("userPass");

const regName = document.getElementById("regName");
const regEmail = document.getElementById("regEmail");
const regPass = document.getElementById("regPass");

const planButtons = document.querySelectorAll(".planBtn");
const tabs = document.querySelectorAll(".tab");
const closeBtns = document.querySelectorAll("[data-close]");

let activeTab = "login";
let chatHistory = [];
let user = JSON.parse(localStorage.getItem("nova_user") || "null");

function openModal() {
  authModal.classList.add("open");
}
function closeModal() {
  authModal.classList.remove("open");
}
function setTab(tab) {
  activeTab = tab;
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  loginForm.classList.toggle("hidden", tab !== "login");
  registerForm.classList.toggle("hidden", tab !== "register");
  authTitle.textContent = tab === "login" ? "Entrar" : "Criar conta";
}

function saveUser(data) {
  user = data;
  localStorage.setItem("nova_user", JSON.stringify(data));
  renderUser();
}

function logout() {
  user = null;
  localStorage.removeItem("nova_user");
  renderUser();
}

function renderUser() {
  if (user) {
    dashText.textContent = `Olá, ${user.name}. Sua conta está ativa.`;
    statusText.textContent = "Logado";
  } else {
    dashText.textContent = "Faça login para ver seus dados.";
    statusText.textContent = "Visitante";
  }
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `${escapeHtml(text)}<span class="meta">${role === "user" ? "Você" : (botName?.value || "NovaAI")} • ${timeNow()}</span>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """)
    .replaceAll("'", "'");
}

function timeNow() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

openLogin?.addEventListener("click", () => {
  setTab("login");
  openModal();
});

openCheckout?.addEventListener("click", () => {
  scrollToSection("plans");
});

startNow?.addEventListener("click", () => {
  scrollToSection("features");
});

scrollPlans?.addEventListener("click", () => {
  scrollToSection("plans");
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => setTab(tab.dataset.tab));
});

closeBtns.forEach(btn => {
  btn.addEventListener("click", () => closeModal());
});

authModal?.addEventListener("click", (e) => {
  if (e.target === authModal) closeModal();
});

planButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    openModal();
    setTab("register");
    regPass.value = regPass.value || "";
    regEmail.focus();
    localStorage.setItem("nova_plan", btn.dataset.plan);
  });
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const txt = chip.textContent.toLowerCase();
    if (txt.includes("gerar")) scrollToSection("gallery");
    if (txt.includes("criar")) openModal();
    if (txt.includes("suporte")) scrollToSection("support");
  });
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    email: userEmail.value.trim(),
    password: userPass.value.trim(),
  };

  try {
    const data = await api("/api/login", payload);
    if (!data.ok) {
      alert(data.message || "Falha no login.");
      return;
    }
    saveUser(data.user);
    closeModal();
    alert("Login realizado com sucesso.");
  } catch {
    alert("Erro ao conectar no servidor.");
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: regName.value.trim(),
    email: regEmail.value.trim(),
    password: regPass.value.trim(),
    plan: localStorage.getItem("nova_plan") || "Start",
  };

  try {
    const data = await api("/api/register", payload);
    if (!data.ok) {
      alert(data.message || "Falha no cadastro.");
      return;
    }
    saveUser(data.user);
    closeModal();
    alert("Cadastro realizado com sucesso.");
  } catch {
    alert("Erro ao conectar no servidor.");
  }
});

ticketForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(ticketForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await api("/api/ticket", payload);
    if (!data.ok) {
      alert(data.message || "Falha ao enviar ticket.");
      return;
    }
    ticketForm.reset();
    alert("Ticket enviado com sucesso.");
  } catch {
    alert("Erro ao conectar no servidor.");
  }
});

sendMsgBtn?.addEventListener("click", sendChat);
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  chatInput.value = "";

  const typing = document.createElement("div");
  typing.className = "msg ai";
  typing.textContent = "Digitando...";
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;

  try {
    const data = await api("/api/chat", {
      message: text,
      history: chatHistory,
      tone: tone?.value || "direto",
      name: botName?.value || "NovaAI",
      user: user || null,
    });

    typing.remove();

    if (!data.ok) {
      addMessage("ai", data.message || "Não consegui responder agora.");
      return;
    }

    const reply = data.reply || "Sem resposta.";
    chatHistory.push({ role: "user", text });
    chatHistory.push({ role: "assistant", text: reply });
    addMessage("ai", reply);
  } catch {
    typing.remove();
    addMessage("ai", "Erro ao conectar no servidor.");
  }
}

function init() {
  setTab("login");
  renderUser();

  if (welcome?.value) {
    messages.innerHTML = "";
    addMessage("ai", welcome.value);
  }

  const savedName = localStorage.getItem("nova_plan");
  if (savedName && !user) {
    dashText.textContent = `Plano selecionado: ${savedName}`;
  }
}

document.addEventListener("DOMContentLoaded", init);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
