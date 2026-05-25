import React, { useState, useEffect } from "react";

const API = "/api/todos";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then((data) => { setTodos(data); setLoading(false); })
      .catch(() => { setError("Could not connect to server"); setLoading(false); });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  async function addTodo() {
    if (!input.trim()) return;
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.trim() }),
    });
    const todo = await res.json();
    setTodos([todo, ...todos]);
    setInput("");
  }

  async function toggleTodo(id, done) {
    const res = await fetch(`${API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !done }),
    });
    const updated = await res.json();
    setTodos(todos.map((t) => (t.id === id ? updated : t)));
  }

  async function deleteTodo(id) {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    setTodos(todos.filter((t) => t.id !== id));
  }

  async function saveEdit(id) {
    if (!editText.trim()) return;
    const res = await fetch(`${API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText.trim() }),
    });
    const updated = await res.json();
    setTodos(todos.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
  }

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  const remaining = todos.filter((t) => !t.done).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>My Tasks</h1>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.addRow}>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add a new task..."
          />
          <button style={styles.addBtn} onClick={addTodo}>Add</button>
        </div>

        <div style={styles.filters}>
          {["all", "active", "done"].map((f) => (
            <button
              key={f}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={styles.muted}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={styles.muted}>Nothing here!</p>
        ) : (
          <ul style={styles.list}>
            {filtered.map((t) => (
              <li key={t.id} style={styles.item}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTodo(t.id, t.done)}
                  style={styles.checkbox}
                />
                {editingId === t.id ? (
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={editText}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(t.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveEdit(t.id)}
                  />
                ) : (
                  <span
                    style={{ ...styles.text, ...(t.done ? styles.done : {}) }}
                    onDoubleClick={() => { setEditingId(t.id); setEditText(t.text); }}
                  >
                    {t.text}
                  </span>
                )}
                <button style={styles.deleteBtn} onClick={() => deleteTodo(t.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}

        <div style={styles.footer}>
          <span style={styles.muted}>{remaining} remaining</span>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  page: { minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 1rem", fontFamily: "system-ui, sans-serif" },
  card: { background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "2rem", width: "100%", maxWidth: 480 },
  title: { fontSize: 24, fontWeight: 600, marginBottom: "1.5rem", color: "#111" },
  error: { background: "#fef2f2", color: "#dc2626", padding: "0.75rem", borderRadius: 8, marginBottom: "1rem", fontSize: 14 },
  addRow: { display: "flex", gap: 8, marginBottom: "1rem" },
  input: { flex: 1, padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 15, outline: "none" },
  addBtn: { padding: "0.6rem 1.2rem", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 500 },
  filters: { display: "flex", gap: 6, marginBottom: "1rem" },
  filterBtn: { padding: "4px 14px", border: "1px solid #e2e8f0", borderRadius: 99, background: "transparent", cursor: "pointer", fontSize: 13, color: "#666" },
  filterActive: { background: "#f1f0fe", borderColor: "#4f46e5", color: "#4f46e5", fontWeight: 500 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 },
  item: { display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 0.75rem", border: "1px solid #f1f1f1", borderRadius: 8 },
  checkbox: { width: 16, height: 16, cursor: "pointer", flexShrink: 0 },
  text: { flex: 1, fontSize: 15, color: "#222", cursor: "default" },
  done: { textDecoration: "line-through", color: "#aaa" },
  deleteBtn: { background: "transparent", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: "2px 4px" },
  footer: { marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #f1f1f1" },
  muted: { color: "#999", fontSize: 14 },
};
