require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* ──────────────────────────── Express app ──────────────────────────── */
const app = express();
const PORT = process.env.PORT || 4000;

/* ──────────────────────── Uploads directory ────────────────────────── */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ────────────────────────── Middleware ──────────────────────────────── */
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, true); // development-friendly: allow all for now
    },
  })
);

app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

/* ─────────────────────── Multer config ─────────────────────────────── */
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = crypto.randomUUID();
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPEG, and WebP images are accepted."));
    }
  },
});

/* ═══════════════════════════ GEMINI ANALYZER ═══════════════════════════ */

async function analyzeWithGemini({ title, description, location, incidentDate, incidentTime, category }) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Sen bir kriz ve yanlış bilgi risk analizi ajanısın.

Aşağıdaki bildirimi analiz et.
Olayın kesin doğru ya da kesin yanlış olduğuna karar verme.
Sadece yanlış bilgi riski, panik dili, kanıt eksikliği, yüksek etkili iddia ve insan doğrulaması ihtiyacını analiz et.

Tüm açıklama metinlerini Türkçe yaz.
Sadece geçerli JSON döndür.
Markdown kullanma.
JSON dışında açıklama yazma.

Bildirim başlığı:
${title}

Açıklama:
${description}

Konum:
${location}

Olay tarihi:
${incidentDate}

Olay saati:
${incidentTime}

Kategori:
${category}

Şu JSON formatını aynen döndür:

{
  "riskLevel": "Low | Medium | High | Critical",
  "confidence": 0-100,
  "summary": "Türkçe kısa analiz",
  "signals": ["Türkçe sinyal", "Türkçe sinyal"],
  "suggestedAction": "Türkçe önerilen aksiyon"
}

ÖNEMLİ — confidence alanı hakkında:
- confidence değeri, olayın doğru olma ihtimali DEĞİLDİR.
- confidence değeri, senin bu risk analizinden ne kadar emin olduğunu gösterir.
- Yani "yanlış bilgi riski değerlendirmemden %85 eminim" anlamına gelir.
- Olayın gerçekliği hakkında yorum yapma.

Ek kurallar:
- riskLevel değeri sadece şunlardan biri olmalı: Low, Medium, High, Critical. Türkçe yazma.
- Eğer olay tarihi gelecekteyse ve iddia kesin gerçekleşmiş gibi yazılmışsa:
  - Bunu summary içinde açıkça belirt.
  - riskLevel genelde High veya Critical olmalı.
  - "Bu kesin yalan" gibi ifade kullanma.
  - "Tarih ileri bir zamanı gösteriyor, doğrulama bekleniyor" gibi dikkatli ifade kullan.
- Eğer iddia yüksek etkili bir kriz iddiasıysa insan doğrulaması gerektiğini söyle.
- Eğer kanıt yoksa kanıt eksikliğini belirt.
- "AI kesin karar verir" gibi konuşma.
- "Bu iddia doğrulama gerektiriyor" gibi dikkatli konuş.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip possible markdown fences
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    riskLevel: parsed.riskLevel,
    confidence: Number(parsed.confidence) || 50,
    summary: parsed.summary || "",
    signals: Array.isArray(parsed.signals) ? parsed.signals : [],
    suggestedAction: parsed.suggestedAction || "",
    source: "gemini",
  };
}

/* ═══════════════════════════ FALLBACK ANALYZER ═════════════════════════ */

const PANIC_KEYWORDS = [
  "baraj patladı",
  "hemen kaç",
  "şehir bitti",
  "herkes ölecek",
  "acil kaçın",
  "bina yıkıldı",
  "deprem oldu",
  "sel bastı",
  "yangın çıktı",
  "patlama",
  "çöktü",
  "çökme",
  "köprü yıkıldı",
  "yol kapandı",
];

function fallbackAnalyzer({ title, description, location, incidentDate, incidentTime, category }) {
  const combined = [title, description, location, incidentDate, incidentTime, category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasPanic = PANIC_KEYWORDS.some((kw) => combined.includes(kw));

  if (hasPanic) {
    return {
      riskLevel: "Critical",
      confidence: 75,
      summary:
        "Bu bildirim panik yaratabilecek veya yüksek etkili bir kriz iddiası içeriyor. Acil insan doğrulaması gerekiyor.",
      signals: ["panik dili", "yüksek etkili kriz iddiası", "insan doğrulaması gerekiyor"],
      suggestedAction:
        "Bu bildirim doğrulanmış tanıklar veya kanıtlar gelmeden güvenilir olarak işaretlenmemeli.",
      source: "fallback",
    };
  }

  return {
    riskLevel: "Medium",
    confidence: 55,
    summary: "Bu bildirimin güvenilir sayılabilmesi için ek kanıt ve bölgedeki kişilerden doğrulama gerekiyor.",
    signals: ["bağımsız kanıt eksikliği", "insan doğrulaması gerekiyor"],
    suggestedAction:
      "Bölgedeki kişilerden fotoğraf, açıklama veya bağlantı ile doğrulama ya da yanlışlama istenmeli.",
    source: "fallback",
  };
}

/* ═══════════════════════════ ROUTES ════════════════════════════════════ */

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "proofwitness-backend" });
});

// 2. Analyze claim
app.post("/api/analyze-claim", async (req, res) => {
  try {
    const { title, description, location, incidentDate, incidentTime, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required." });
    }

    const payload = { title, description, location, incidentDate, incidentTime, category };

    // Try Gemini first
    if (process.env.GEMINI_API_KEY) {
      try {
        const result = await analyzeWithGemini(payload);
        return res.json(result);
      } catch (geminiErr) {
        console.error("[Gemini Error]", geminiErr.message || geminiErr);
        // fall through to fallback
      }
    }

    // Fallback
    const result = fallbackAnalyzer(payload);
    return res.json(result);
  } catch (err) {
    console.error("[analyze-claim]", err);
    res.status(500).json({
      riskLevel: "Medium",
      confidence: 50,
      summary: "Analysis temporarily unavailable.",
      signals: ["service error"],
      suggestedAction: "Try again later.",
      source: "fallback",
    });
  }
});

// 3. Upload evidence
app.post("/api/upload-evidence", (req, res) => {
  upload.single("evidence")(req, res, (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError
          ? `Upload error: ${err.message}`
          : err.message || "Upload failed.";
      return res.status(400).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided. Field name must be 'evidence'." });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  });
});

/* ═══════════════════════════ START SERVER ══════════════════════════════ */
app.listen(PORT, () => {
  console.log(`\n  🚀  ProofWitness backend running → http://localhost:${PORT}`);
  console.log(`  📡  Health check → http://localhost:${PORT}/api/health`);
  console.log(
    `  🤖  Gemini API key: ${process.env.GEMINI_API_KEY ? "configured ✓" : "NOT SET — using fallback analyzer"}`
  );
  console.log();
});
