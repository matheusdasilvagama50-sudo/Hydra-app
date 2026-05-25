require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

const JWT_SECRET = process.env.JWT_SECRET || "troque-essa-chave";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], tickets: [] }, null, 2)
    );
  }
}

function readDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function signUser(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ ok: false, message: "Sem token." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Token inválido." });
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, plan } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "Preencha tudo." });
    }

    const db = readDB();
    const exists = db.users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );
    if (exists) {
      return res.status(400).json({ ok: false, message: "E-mail já cadastrado." });
    }

    const user = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      plan: plan || "Start",
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    writeDB(db);

    const token = signUser(user);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Erro no cadastro." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "Preencha tudo." });
    }

    const db = readDB();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
      return res.status(400).json({ ok: false, message: "Usuário não encontrado." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ ok: false, message: "Senha incorreta." });
    }

    const token = signUser(user);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Erro no login." });
  }
});

app.post("/api/ticket", (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, message: "Preencha tudo." });
    }

    const db = readDB();
    db.tickets.push({
      id: Date.now().toString(),
      name,
      email,
      message,
      status: "open",
      createdAt: new Date().toISOString(),
    });
    writeDB(db);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Erro ao enviar ticket." });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], tone = "direto", name = "NovaAI", user } = req.body || {};
    if (!message) {
      return res.status(400).json({ ok: false, message: "Mensagem vazia." });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        ok: false,
        message: "Faltou configurar a chave da IA no servidor.",
      });
    }

    const systemPrompt = `
Você é ${name}, um assistente de suporte de site.
Tom: ${tone}.
Responda curto, claro, útil e amigável.
Se o usuário pedir recursos do site, explique de forma prática.
Se houver dúvida, peça uma informação por vez.
`;

    const contents = [
      ...history.map((item) => ({
        role: item.role === "user" ? "user" : "model",
        parts: [{ text: item.text }],
      })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL
      )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        }),
      }
    );

    const data = await response.json();

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("") || "Não consegui responder agora.";

    res.json({ ok: true, reply });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Erro no chat da IA." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
