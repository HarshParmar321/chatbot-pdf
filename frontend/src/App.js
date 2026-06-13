import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";


function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF first!");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("http://127.0.0.1:8000/upload", formData);
      setUploaded(true);
      setUploadedName(file.name);
      setMessages([{ role: "system", text: `✅ "${file.name}" uploaded successfully! Ask me anything about it.` }]);
    } catch (err) {
      alert("Upload failed. Make sure backend is running!");
    }
    setUploading(false);
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    if (!uploaded) return alert("Please upload a PDF first!");
    const userMsg = { role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/ask", { question });
      setMessages((prev) => [...prev, { role: "bot", text: res.data.answer }]);
    } catch (err) {
      alert("Something went wrong!");
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.logo}>📄 PDF Chat</div>
        <div style={s.sidebarLabel}>Upload your PDF</div>
        <label style={s.fileLabel}>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ display: "none" }}
          />
          <div style={s.fileBox}>
            {file ? `📎 ${file.name}` : "Click to select PDF"}
          </div>
        </label>
        <button
          onClick={handleUpload}
          disabled={uploading}
          style={uploading ? { ...s.uploadBtn, opacity: 0.6 } : s.uploadBtn}
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </button>
        {uploaded && (
          <div style={s.uploadedBadge}>
            ✅ {uploadedName}
          </div>
        )}
        <div style={s.sidebarFooter}>
          Built with FastAPI + Groq + Supabase
        </div>
      </div>

      {/* Main Chat */}
      <div style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <span style={s.headerTitle}>PDF Chatbot</span>
          <span style={s.headerSub}>Powered by Groq LLaMA 3.3</span>
        </div>

        {/* Messages */}
        <div style={s.chatArea}>
          {messages.length === 0 && (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>💬</div>
              <p style={s.emptyText}>Upload a PDF from the sidebar and start asking questions</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={msg.role === "user" ? s.userRow : s.botRow}>
              {msg.role !== "user" && (
                <div style={msg.role === "bot" ? s.botAvatar : s.systemAvatar}>
                  {msg.role === "bot" ? "🤖" : "ℹ️"}
                </div>
              )}
              <div style={msg.role === "user" ? s.userBubble : msg.role === "bot" ? s.botBubble : s.systemBubble}>
                {msg.role === "bot" ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
              {msg.role === "user" && <div style={s.userAvatar}>👤</div>}
            </div>
          ))}
          {loading && (
            <div style={s.botRow}>
              <div style={s.botAvatar}>🤖</div>
              <div style={s.typingBubble}>
                <span style={s.dot1}>●</span>
                <span style={s.dot2}>●</span>
                <span style={s.dot3}>●</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={s.inputArea}>
          <div style={s.inputBox}>
            <input
              type="text"
              placeholder={uploaded ? "Ask anything about your PDF..." : "Upload a PDF first..."}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              style={s.input}
              disabled={!uploaded}
            />
            <button
              onClick={handleAsk}
              disabled={!uploaded || loading}
              style={!uploaded || loading ? { ...s.sendBtn, opacity: 0.4 } : s.sendBtn}
            >
              ➤
            </button>
          </div>
          <p style={s.inputHint}>Press Enter or click ➤ to send</p>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#ececec",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    width: "260px",
    backgroundColor: "#171717",
    borderRight: "1px solid #2a2a2a",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  logo: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: "12px",
  },
  sidebarLabel: {
    fontSize: "11px",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  fileLabel: { cursor: "pointer" },
  fileBox: {
    backgroundColor: "#222",
    border: "1px dashed #444",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "13px",
    color: "#aaa",
    textAlign: "center",
    cursor: "pointer",
    wordBreak: "break-all",
  },
  uploadBtn: {
    backgroundColor: "#10a37f",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    width: "100%",
  },
  uploadedBadge: {
    backgroundColor: "#1a2e1a",
    color: "#4caf50",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    wordBreak: "break-all",
  },
  sidebarFooter: {
    marginTop: "auto",
    fontSize: "11px",
    color: "#444",
    textAlign: "center",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #2a2a2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f0f0f",
  },
  headerTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
  },
  headerSub: {
    fontSize: "12px",
    color: "#555",
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "12px",
    opacity: 0.4,
  },
  emptyIcon: { fontSize: "48px" },
  emptyText: { fontSize: "14px", color: "#888", textAlign: "center" },
  userRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: "8px",
  },
  botRow: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: "8px",
  },
  userBubble: {
    backgroundColor: "#2f2f2f",
    color: "#ececec",
    padding: "12px 16px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "70%",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  botBubble: {
    backgroundColor: "#1a1a1a",
    color: "#ececec",
    padding: "12px 16px",
    borderRadius: "18px 18px 18px 4px",
    maxWidth: "70%",
    fontSize: "14px",
    lineHeight: "1.6",
    border: "1px solid #2a2a2a",
  },
  systemBubble: {
    backgroundColor: "#0d2d1f",
    color: "#4caf50",
    padding: "10px 16px",
    borderRadius: "12px",
    fontSize: "13px",
    border: "1px solid #1a4a2e",
    width: "100%",
    textAlign: "center",
  },
  typingBubble: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    padding: "12px 16px",
    borderRadius: "18px 18px 18px 4px",
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  dot1: { fontSize: "8px", color: "#555", animation: "pulse 1s infinite" },
  dot2: { fontSize: "8px", color: "#555", animation: "pulse 1s infinite 0.2s" },
  dot3: { fontSize: "8px", color: "#555", animation: "pulse 1s infinite 0.4s" },
  botAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    flexShrink: 0,
  },
  userAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#2f2f2f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    flexShrink: 0,
  },
  systemAvatar: {
    width: "32px",
    height: "32px",
    fontSize: "16px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inputArea: {
    padding: "16px 24px",
    borderTop: "1px solid #2a2a2a",
    backgroundColor: "#0f0f0f",
  },
  inputBox: {
    display: "flex",
    gap: "8px",
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "12px",
    padding: "8px 12px",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    border: "none",
    outline: "none",
    color: "#ececec",
    fontSize: "14px",
    padding: "4px 0",
  },
  sendBtn: {
    backgroundColor: "#10a37f",
    border: "none",
    borderRadius: "8px",
    color: "white",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inputHint: {
    fontSize: "11px",
    color: "#444",
    textAlign: "center",
    marginTop: "8px",
  },
};

export default App;