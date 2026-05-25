require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("✅ DB ready");
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve React build in production
app.use(express.static(path.join(__dirname, "../../client/build")));

// ── Routes ────────────────────────────────────────────────────────────────────

// Get all todos
app.get("/api/todos", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM todos ORDER BY created_at DESC"
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create todo
app.post("/api/todos", async (req, res) => {
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({
      error: "Text is required",
    });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO todos (text) VALUES ($1) RETURNING *",
      [text.trim()]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update todo
app.patch("/api/todos/:id", async (req, res) => {
  const { id } = req.params;
  const { text, done } = req.body;

  try {
    const { rows } = await pool.query(
      `
      UPDATE todos
      SET text = COALESCE($1, text),
          done = COALESCE($2, done)
      WHERE id = $3
      RETURNING *
      `,
      [text?.trim() ?? null, done ?? null, id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "Not found",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete todo
app.delete("/api/todos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query("DELETE FROM todos WHERE id = $1", [
      id,
    ]);

    if (!rowCount) {
      return res.status(404).json({
        error: "Not found",
      });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client/build/index.html"));
});

// ── Start Server ──────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB init failed:", err.message);
    process.exit(1);
  });
