import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

function Mascot({ size = 58, animated = true, showSparks = false, style = {} }) {
  return (
    <div
      className={`mascot-wrap${animated ? " mascot" : ""}`}
      style={{ ...s.mascotWrap, width: size, height: size, ...style }}
    >
      <span style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }} aria-hidden>
        📄
      </span>
      {showSparks && (
        <>
          <div className="mascot-spark" style={s.sparkOne}>
            ✨
          </div>
          <div
            className="mascot-spark"
            style={{ ...s.sparkTwo, animationDelay: "1.1s" }}
          >
            ⭐
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDetail, setUploadDetail] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [question]);

  const isPdfFile = (f) => {
    if (!f) return false;
    const name = f.name?.toLowerCase() || "";
    return (
      f.type === "application/pdf" ||
      f.type === "application/x-pdf" ||
      name.endsWith(".pdf")
    );
  };

  const pickFile = (f) => {
    if (!f) return;
    if (isPdfFile(f)) {
      setFile(f);
    } else {
      alert("Please choose a PDF file.");
    }
  };

  const triggerFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadDetail("Uploading PDF to server...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_URL}/upload`, formData);

      // Upload is accepted immediately; poll until PDF processing finishes (up to 10 mins).
      let ready = false;
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await axios.get(`${API_URL}/status`);

        if (res.data.error) {
          throw new Error(res.data.error);
        }

        if (typeof res.data.progress === "number") {
          setUploadProgress(res.data.progress);
        }
        if (res.data.detail) {
          setUploadDetail(res.data.detail);
        }

        if (res.data.ready) {
          ready = true;
          break;
        }
      }

      if (!ready) {
        throw new Error(
          "The PDF is taking too long to process. Check the backend terminal for details."
        );
      }

      setUploaded(true);
      setUploadedName(file.name);
      setSidebarOpen(false);
      setMessages([
        {
          role: "system",
          text: `🎉 "${file.name}" is loaded! Ask me anything about it.`,
        },
      ]);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        "Unknown upload error";
      alert(`Upload failed: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!uploaded) return;
    const userMsg = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/ask`, { question: trimmed });
      setMessages((prev) => [...prev, { role: "bot", text: res.data.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "😬 Oops, something went wrong. Try again?" },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const resetFile = () => {
    setFile(null);
    setUploaded(false);
    setUploadedName("");
    setUploadProgress(0);
    setUploadDetail("");
    setMessages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderUploadPanel = (mobile = false) => (
    <>
      {!uploaded ? (
        <>
          <div
            className="drop-zone-label"
            role="button"
            tabIndex={0}
            onClick={triggerFilePick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                triggerFilePick();
              }
            }}
            style={{
              ...s.dropZone,
              ...(mobile ? s.dropZoneMobile : {}),
              ...(dragOver ? s.dropZoneActive : {}),
              ...(file ? s.dropZoneFilled : {}),
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="drop-icon-circle" style={s.dropIconCircle}>
              <span style={s.dropIcon}>{file ? "📄" : "🎈"}</span>
            </div>
            <div style={s.dropText}>
              {file ? file.name : mobile ? "Tap to choose a PDF" : "Drop a PDF here, or tap to browse"}
            </div>
            {!file && (
              <div style={s.dropHint}>One document at a time, please!</div>
            )}
          </div>

          {uploading && (
            <div className="progress-container" style={s.progressContainer}>
              <div style={s.progressHeader}>
                <span style={s.progressLabel}>{uploadDetail || "Processing PDF..."}</span>
                <span style={s.progressPercent}>{uploadProgress}%</span>
              </div>
              <div style={s.progressBarTrack}>
                <div
                  className="progress-bar-fill"
                  style={{
                    ...s.progressBarFill,
                    width: `${Math.max(uploadProgress, 6)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={!file || uploading}
            style={
              !file || uploading
                ? {
                    ...s.uploadBtn,
                    opacity: uploading ? 0.9 : 0.5,
                    cursor: uploading ? "wait" : "default",
                    boxShadow: "0 5px 0 #5A3FC4",
                  }
                : s.uploadBtn
            }
          >
            {uploading ? `Processing… ${uploadProgress}% 🌀` : "Let's go! 🚀"}
          </button>
        </>
      ) : (
        <div style={s.catalogCard}>
          <div style={s.catalogTab}>✅ Ready</div>
          <div style={s.catalogEmoji}>📚</div>
          <div style={s.catalogTitle}>{uploadedName}</div>
          <div style={s.catalogMeta}>Ask away — I've read it all!</div>
          <button className="swap-btn" onClick={resetFile} style={s.swapBtn}>
            🔄 Try a different PDF
          </button>
        </div>
      )}
    </>
  );

  return (
    <div style={s.page}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        aria-hidden
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; }

        html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: linear-gradient(160deg, #FFF4E0 0%, #FFE9F3 45%, #ECE6FF 100%);
}

        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: #FFD3E6;
          border-radius: 10px;
          border: 2px solid transparent;
        }
        ::-webkit-scrollbar-thumb:hover { background: #FFB8D6; }

        textarea::placeholder, input::placeholder { color: #B7A8D6; }

        button:focus-visible, textarea:focus-visible, label:focus-visible {
          outline: 3px solid #6C5CE7;
          outline-offset: 2px;
        }

        @keyframes popIn {
          0% { opacity: 0; transform: translateY(14px) scale(0.94); }
          70% { transform: translateY(-2px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(8deg); }
        }
        @keyframes bounceDot {
          0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.6; }
          40% { transform: translateY(-8px) scale(1.1); opacity: 1; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(20deg); }
        }

        .msg-enter { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }

        .mascot { animation: bob 3.5s ease-in-out infinite; }
        .mascot-spark { animation: sparkle 2.2s ease-in-out infinite; }

        @keyframes progressStripes {
          0% { background-position: 0 0; }
          100% { background-position: 30px 0; }
        }
        .progress-bar-fill {
          transition: width 0.35s ease-out;
          background-image: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.25) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.25) 50%,
            rgba(255, 255, 255, 0.25) 75%,
            transparent 75%,
            transparent
          );
          background-size: 20px 20px;
          animation: progressStripes 1s linear infinite;
        }

        .drop-zone-label {
          transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
        }
        .drop-zone-label:hover {
          transform: translateY(-2px) scale(1.01);
        }
        .drop-zone-label:hover .drop-icon-circle {
          animation: wiggle 0.5s ease-in-out;
        }

        .upload-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .upload-btn:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.02);
          filter: brightness(1.06);
          box-shadow: 0 8px 0 #5A3FC4, 0 12px 24px rgba(108,92,231,0.35) !important;
        }
        .upload-btn:active:not(:disabled) {
          transform: translateY(2px) scale(0.99);
          box-shadow: 0 3px 0 #5A3FC4 !important;
        }

        .swap-btn {
          transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }
        .swap-btn:hover {
          transform: translateY(-1px);
          background: #FFE8F3 !important;
          border-color: #FF7AB8 !important;
          color: #E84393 !important;
        }

        .send-btn {
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, filter 0.15s ease;
        }
        .send-btn:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.08) rotate(-6deg);
          filter: brightness(1.05);
        }
        .send-btn:active:not(:disabled) {
          transform: scale(0.94) rotate(0deg);
        }

        .menu-btn {
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .menu-btn:hover {
          transform: scale(1.06) rotate(-4deg);
          background: #FFE8F3 !important;
        }

        .input-box {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .input-box:focus-within {
          border-color: #6C5CE7 !important;
          box-shadow: 0 6px 0 #E4DEFF, 0 0 0 4px rgba(108,92,231,0.12) !important;
          transform: translateY(-2px);
        }

        .user-bubble, .bot-bubble {
          transition: transform 0.18s ease;
        }
        .user-bubble:hover, .bot-bubble:hover {
          transform: translateY(-2px);
        }

        /* Replace your existing .markdown CSS block with this */

.markdown p { margin: 0 0 10px 0; }
.markdown p:last-child { margin-bottom: 0; }

.markdown ul, .markdown ol { margin: 8px 0 14px 22px; padding: 0; }
.markdown li { margin-bottom: 6px; line-height: 1.6; }
.markdown li::marker { color: #6C5CE7; font-weight: 800; }

.markdown strong {
  color: #E84393;
  font-weight: 800;
  background: linear-gradient(180deg, transparent 60%, #FFE0EF 60%);
  padding: 0 2px;
  border-radius: 3px;
}

.markdown a { color: #00B894; text-decoration: underline; font-weight: 700; }

.markdown code {
  background: #FFF1B8;
  border: 1.5px solid #FFE08A;
  border-radius: 6px;
  padding: 2px 7px;
  font-family: 'Nunito', monospace;
  font-weight: 800;
  font-size: 12.5px;
  color: #B8860B;
}

.markdown pre {
  background: #2D2A4A;
  color: #F4F1FF;
  padding: 14px 16px;
  border-radius: 12px;
  overflow-x: auto;
  font-size: 12.5px;
  font-family: 'Nunito', monospace;
  margin: 8px 0;
}
.markdown pre code { background: none; border: none; padding: 0; color: inherit; }

.markdown h1, .markdown h2, .markdown h3 {
  font-family: 'Baloo 2', sans-serif;
  margin: 10px 0 8px 0;
  color: #4834D4;
  line-height: 1.3;
}
.markdown h1 { font-size: 19px; font-weight: 800; }
.markdown h2 {
  font-size: 16.5px;
  font-weight: 800;
  padding-bottom: 4px;
  border-bottom: 2.5px solid #E4DEFF;
}
.markdown h3 {
  font-size: 14.5px;
  font-weight: 800;
  color: #6C5CE7;
}

.markdown h1:first-child,
.markdown h2:first-child,
.markdown h3:first-child {
  margin-top: 0;
}

.markdown blockquote {
  border-left: 4px solid #FF7AB8;
  margin: 8px 0;
  padding: 6px 12px;
  color: #8A7FAE;
  font-style: italic;
  background: #FFF6FB;
  border-radius: 0 8px 8px 0;
}

.markdown hr {
  border: none;
  border-top: 2px dashed #E4DEFF;
  margin: 12px 0;
}

.markdown table {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
  font-size: 13px;
}
.markdown th, .markdown td {
  border: 1.5px solid #E4DEFF;
  padding: 6px 10px;
  text-align: left;
}
.markdown th {
  background: #F0ECFF;
  color: #4834D4;
  font-weight: 800;
}

        .menu-btn-el { display: none; }
        .sidebar-overlay { display: none; }
        .hide-mobile { }
        .show-mobile { display: none !important; }
        .mobile-upload-screen { display: none; }

        @media (max-width: 880px) {
          .hide-mobile {
            display: none !important;
          }
          .show-mobile {
            display: flex !important;
          }
          .sidebar,
          .sidebar-overlay,
          .menu-btn-el {
            display: none !important;
          }
          .main {
            width: 100% !important;
          }
          .mobile-upload-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            padding: 20px 16px 24px;
            gap: 18px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .mobile-upload-card {
            width: 100%;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .mobile-brand {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 10px;
            margin-bottom: 4px;
          }
          .mobile-brand-title {
            font-family: 'Baloo 2', sans-serif;
            font-size: 24px;
            font-weight: 800;
            color: #2D2A4A;
            margin: 0;
          }
          .mobile-brand-sub {
            font-size: 13px;
            color: #9089B5;
            font-weight: 700;
            margin: 0;
            line-height: 1.5;
          }
          .mobile-change-btn {
            flex-shrink: 0;
            border: 2.5px solid #2D2A4A;
            background: #FFFFFF;
            border-radius: 12px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 800;
            color: #2D2A4A;
            cursor: pointer;
            box-shadow: 0 3px 0 #2D2A4A;
            font-family: 'Nunito', sans-serif;
          }
          .header {
            padding: 14px 16px !important;
          }
          .header-title {
            max-width: 100% !important;
            font-size: 16px !important;
            white-space: normal !important;
          }
          .header-sub {
            display: block !important;
            font-size: 12px !important;
          }
          .header-badge {
            display: none;
          }
          .chat-area {
            padding: 16px !important;
            gap: 14px !important;
          }
          .chat-area.mobile-chat-hidden {
            display: none !important;
          }
          .user-bubble, .bot-bubble {
            max-width: 88% !important;
            font-size: 14.5px !important;
          }
          .input-area {
            padding: 12px 14px calc(16px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .input-area.mobile-input-hidden {
            display: none !important;
          }
          .input-hint {
            display: none;
          }
          .empty-state {
            max-width: 290px !important;
          }
          .mascot-wrap {
            transform: none;
          }
        }

        @media (max-width: 420px) {
          .user-bubble, .bot-bubble {
            max-width: 92% !important;
            padding: 12px 14px !important;
          }
          .chat-area {
            padding: 12px !important;
          }
          .brand-title {
            font-size: 19px !important;
          }
        }
      `}</style>

      {/* floating background blobs */}
      <div style={s.blobOne} />
      <div style={s.blobTwo} />
      <div style={s.blobThree} />

      {/* Sidebar — desktop only */}
      <div
        className={`sidebar hide-mobile${sidebarOpen ? " sidebar-open" : ""}`}
        style={s.sidebar}
      >
        <div style={s.brand}>
          <Mascot size={58} showSparks animated />
          <div>
            <div className="brand-title" style={s.brandTitle}>PDF Buddy</div>
            <div style={s.brandSub}>Your friendly document sidekick</div>
          </div>
        </div>

        <div style={s.sidebarLabel}>📥 Step 1 — Add your PDF</div>
        {renderUploadPanel(false)}

        <div style={s.sidebarLabel}>💬 Step 2 — Start chatting!</div>
        <div style={s.tipBox}>
          <span style={s.tipEmoji}>💡</span>
          <span style={s.tipText}>
            Try: "Summarize this in 3 bullet points" or "What's the main
            takeaway?"
          </span>
        </div>

        <div style={s.sidebarFooter} className="">
          <span>Made by Gujju</span>
        </div>
      </div>

      <div
        className={`sidebar-overlay hide-mobile${sidebarOpen ? " visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main Chat */}
      <div style={s.main} className="main">
        <div style={s.header} className="header">
          <button
            className="menu-btn-el hide-mobile"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open document menu"
          >
            🍔
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={s.headerTitle} className="header-title">
              {uploaded ? `📄 ${uploadedName}` : "👋 PDF Buddy"}
            </div>
            <div style={s.headerSub} className="header-sub">
              {uploaded
                ? "Ask me anything about your PDF!"
                : "Upload a PDF to get started"}
            </div>
          </div>
          {uploaded && (
            <button
              type="button"
              className="show-mobile mobile-change-btn"
              onClick={resetFile}
            >
              Change
            </button>
          )}
          {/* <div style={s.headerBadge} className="header-badge hide-mobile">
            ⚡ LLaMA 3.3
          </div> */}
        </div>

        {!uploaded && (
          <div className="show-mobile mobile-upload-screen">
            <div className="mobile-brand">
              <Mascot size={88} showSparks animated />
              <p className="mobile-brand-title">Upload your PDF</p>
              <p className="mobile-brand-sub">
                Pick a document, then ask questions — summaries, key points, anything!
              </p>
            </div>
            <div className="mobile-upload-card">{renderUploadPanel(true)}</div>
            <div style={{ ...s.tipBox, width: "100%", maxWidth: "420px" }}>
              <span style={s.tipEmoji}>💡</span>
              <span style={s.tipText}>
                Try: "Summarize this in 3 bullet points"
              </span>
            </div>
          </div>
        )}

        <div
          style={s.chatArea}
          className={`chat-area${!uploaded ? " mobile-chat-hidden" : ""}`}
        >
          {messages.length === 0 && uploaded && (
            <div style={s.emptyState} className="empty-state hide-mobile">
              <Mascot size={84} animated />
              <p style={s.emptyTitle}>You're all set!</p>
              <p style={s.emptyText}>
                Fire away with whatever you're curious about in your PDF!
              </p>
            </div>
          )}

          {messages.length === 0 && uploaded && (
            <div style={s.emptyState} className="empty-state show-mobile">
              <Mascot size={72} animated />
              <p style={s.emptyTitle}>Ready to chat!</p>
              <p style={s.emptyText}>
                Type a question below and I'll help you understand your PDF.
              </p>
            </div>
          )}

          {messages.length === 0 && !uploaded && (
            <div style={s.emptyState} className="empty-state hide-mobile">
              <Mascot size={84} animated />
              <p style={s.emptyTitle}>Nothing here yet!</p>
              <p style={s.emptyText}>
                Pop a PDF in from the side panel and I'll dig right in. Then
                fire away with whatever you're curious about!
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div key={i} className="msg-enter" style={s.systemRow}>
                  <div style={s.systemBubble}>{msg.text}</div>
                </div>
              );
            }
            if (msg.role === "user") {
              return (
                <div key={i} className="msg-enter" style={s.userRow}>
                  <div className="user-bubble" style={s.userBubble}>
                    {msg.text}
                  </div>
                  <div style={s.userAvatar}>🙂</div>
                </div>
              );
            }
            return (
              <div key={i} className="msg-enter" style={s.botRow}>
                <div style={s.botAvatar}>
                  <Mascot size={40} animated={false} style={{ borderRadius: "12px", boxShadow: "none" }} />
                </div>
                <div className="bot-bubble" style={s.botBubble}>
                  <div className="markdown">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="msg-enter" style={s.botRow}>
              <div style={s.botAvatar}>
                <Mascot size={40} animated={false} style={{ borderRadius: "12px", boxShadow: "none" }} />
              </div>
              <div className="bot-bubble" style={s.botBubble}>
                <div style={s.typingRow}>
                  <span style={{ ...s.dot, animationDelay: "0s" }} />
                  <span style={{ ...s.dot, animationDelay: "0.15s" }} />
                  <span style={{ ...s.dot, animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div
          style={s.inputArea}
          className={`input-area${!uploaded ? " mobile-input-hidden" : ""}`}
        >
          <div className="input-box" style={s.inputBox}>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={
                uploaded
                  ? "Ask me something about this PDF… 🤔"
                  : "Upload a PDF to start chatting"
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              style={s.input}
              disabled={!uploaded}
            />
            <button
              className="send-btn"
              onClick={handleAsk}
              disabled={!uploaded || loading || !question.trim()}
              style={
                !uploaded || loading || !question.trim()
                  ? { ...s.sendBtn, opacity: 0.4, cursor: "default", boxShadow: "0 4px 0 #5A3FC4" }
                  : s.sendBtn
              }
              aria-label="Send question"
            >
              🚀
            </button>
          </div>
          <p style={s.inputHint} className="input-hint">
            Press Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}

const PURPLE = "#6C5CE7";
const PURPLE_DARK = "#4834D4";
const PINK = "#FF7AB8";
const YELLOW = "#FFC857";
const MINT = "#00D2A0";
const INK = "#2D2A4A";
const CREAM = "#FFF9F0";

const s = {
  page: {
  display: "flex",
  height: "100dvh",
  width: "100%",
  background: `linear-gradient(160deg, #FFF4E0 0%, #FFE9F3 45%, #ECE6FF 100%)`,
  color: INK,
  fontFamily: "'Nunito', -apple-system, sans-serif",
  overflow: "hidden",
  position: "fixed",
  inset: 0,           // top/left/right/bottom: 0 in one line
  isolation: "isolate", // creates a new stacking/clipping context
},

  blobOne: {
    position: "absolute",
    top: "-120px",
    right: "-100px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${YELLOW}55 0%, transparent 70%)`,
    pointerEvents: "none",
    zIndex: 0,
  },
  blobTwo: {
  position: "absolute",
  bottom: "-100px",      /* reduce overflow */
  left: "30%",
  width: "380px",
  // height: "260px",
  borderRadius: "50%",
  background: `radial-gradient(circle, ${PINK}40 0%, transparent 70%)`,
  pointerEvents: "none",
  zIndex: 0,
  overflow: "hidden",
},
  blobThree: {
    position: "absolute",
    top: "30%",
    right: "8%",
    width: "260px",
    height: "260px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${MINT}33 0%, transparent 70%)`,
    pointerEvents: "none",
    zIndex: 0,
  },

  /* Sidebar */
  sidebar: {
    width: "310px",
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    borderRight: `3px solid ${INK}`,
    padding: "26px 22px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "relative",
    zIndex: 2,
    overflowY: "auto",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  mascotWrap: {
    position: "relative",
    width: "58px",
    height: "58px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(145deg, #FFF6E0 0%, #FFE9F3 55%, #ECE6FF 100%)",
    borderRadius: "18px",
    border: `3px solid ${INK}`,
    boxShadow: `0 4px 0 ${INK}`,
    overflow: "visible",
  },
  sparkOne: {
    position: "absolute",
    top: "-8px",
    right: "-8px",
    fontSize: "16px",
  },
  sparkTwo: {
    position: "absolute",
    bottom: "-6px",
    left: "-10px",
    fontSize: "14px",
  },
  brandTitle: {
    fontFamily: "'Baloo 2', sans-serif",
    fontSize: "22px",
    fontWeight: 800,
    color: INK,
    letterSpacing: "0.01em",
  },
  brandSub: {
    fontSize: "12px",
    color: "#9089B5",
    marginTop: "2px",
    fontWeight: 700,
  },

  sidebarLabel: {
    fontFamily: "'Baloo 2', sans-serif",
    fontSize: "14px",
    fontWeight: 700,
    color: INK,
    marginTop: "4px",
  },

  dropZone: {
    cursor: "pointer",
    border: `3px dashed ${PURPLE}66`,
    borderRadius: "18px",
    padding: "26px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    textAlign: "center",
    backgroundColor: "#FAF8FF",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  dropZoneMobile: {
    padding: "22px 14px",
    minHeight: "148px",
  },
  dropZoneActive: {
    borderColor: PURPLE,
    backgroundColor: "#F0ECFF",
  },
  dropZoneFilled: {
    borderColor: MINT,
    backgroundColor: "#EEFFF9",
    borderStyle: "solid",
  },
  dropIconCircle: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    border: `3px solid ${INK}`,
    backgroundColor: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 3px 0 ${INK}`,
  },
  dropIcon: {
    fontSize: "22px",
  },
  dropText: {
    fontSize: "13.5px",
    color: INK,
    wordBreak: "break-all",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  dropHint: {
    fontSize: "11.5px",
    color: "#A99FC9",
    fontWeight: 700,
  },

  progressContainer: {
    backgroundColor: "#FFFFFF",
    border: `2.5px solid ${INK}`,
    borderRadius: "16px",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    boxShadow: `0 3px 0 ${INK}`,
    marginTop: "2px",
    marginBottom: "2px",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
    fontWeight: 800,
    color: INK,
  },
  progressLabel: {
    fontFamily: "'Nunito', sans-serif",
    color: PURPLE_DARK,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "78%",
  },
  progressPercent: {
    fontFamily: "'Baloo 2', sans-serif",
    fontSize: "14px",
    color: PURPLE,
    fontWeight: 800,
  },
  progressBarTrack: {
    width: "100%",
    height: "12px",
    backgroundColor: "#ECE6FF",
    borderRadius: "999px",
    border: `2px solid ${INK}`,
    overflow: "hidden",
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: "999px",
    background: `linear-gradient(90deg, ${PURPLE} 0%, ${PINK} 50%, ${YELLOW} 100%)`,
  },

  uploadBtn: {
    background: `linear-gradient(135deg, ${PURPLE} 0%, #8C7AFF 100%)`,
    color: "#FFFFFF",
    border: `3px solid ${INK}`,
    borderRadius: "14px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Baloo 2', sans-serif",
    letterSpacing: "0.02em",
    boxShadow: `0 5px 0 #5A3FC4`,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },

  catalogCard: {
    background: `linear-gradient(160deg, #FFFFFF 0%, #F4F0FF 100%)`,
    color: INK,
    borderRadius: "18px",
    padding: "20px 16px 16px",
    position: "relative",
    border: `3px solid ${INK}`,
    boxShadow: `0 5px 0 ${INK}`,
    textAlign: "center",
  },
  catalogTab: {
    position: "absolute",
    top: "-14px",
    left: "50%",
    transform: "translateX(-50%)",
    background: MINT,
    color: "#FFFFFF",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "5px 14px",
    borderRadius: "999px",
    border: `2.5px solid ${INK}`,
    whiteSpace: "nowrap",
  },
  catalogEmoji: {
    fontSize: "36px",
    marginTop: "6px",
  },
  catalogTitle: {
    fontFamily: "'Baloo 2', sans-serif",
    fontSize: "15px",
    fontWeight: 700,
    marginTop: "8px",
    wordBreak: "break-word",
    lineHeight: 1.35,
  },
  catalogMeta: {
    fontSize: "12.5px",
    color: "#9089B5",
    marginTop: "6px",
    fontWeight: 700,
  },
  swapBtn: {
    marginTop: "16px",
    background: "#FFFFFF",
    border: `2.5px solid #D8D0F5`,
    color: "#9089B5",
    borderRadius: "12px",
    padding: "9px 10px",
    fontSize: "13px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 800,
  },

  tipBox: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    background: "#FFF6E0",
    border: `2.5px solid ${YELLOW}`,
    borderRadius: "14px",
    padding: "12px 14px",
  },
  tipEmoji: {
    fontSize: "18px",
    flexShrink: 0,
  },
  tipText: {
    fontSize: "12.5px",
    color: "#8A6D1F",
    lineHeight: 1.5,
    fontWeight: 700,
  },

  sidebarFooter: {
    marginTop: "auto",
    fontSize: "14px",
    color: "#cd7e08",
    fontWeight: 800,
    textAlign: "center",
    paddingTop: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  footerMascotImg: {
    width: "18px",
    height: "18px",
    borderRadius: "5px",
    objectFit: "cover",
    border: `1.5px solid ${INK}`,
  },

  /* Main */
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
    minHeight: 0,
    position: "relative",
    zIndex: 1,
  },
  header: {
    padding: "20px 32px",
    borderBottom: `3px solid ${INK}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    backgroundColor: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(6px)",
  },
  headerTitle: {
    fontFamily: "'Baloo 2', sans-serif",
    fontSize: "19px",
    fontWeight: 800,
    color: INK,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "420px",
  },
  headerSub: {
    fontSize: "12.5px",
    color: "#9089B5",
    marginTop: "3px",
    fontWeight: 700,
  },
  headerBadge: {
    fontSize: "12px",
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700,
    color: PURPLE_DARK,
    border: `2.5px solid ${PURPLE}`,
    background: "#F0ECFF",
    borderRadius: "999px",
    padding: "6px 14px",
    whiteSpace: "nowrap",
  },

  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    position: "relative",
    zIndex: 1,
  },

  emptyState: {
    margin: "auto",
    textAlign: "center",
    maxWidth: "380px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  emptyTitle: {
    fontFamily: "'Baloo 2', sans-serif",
    fontSize: "22px",
    fontWeight: 800,
    color: INK,
    margin: 0,
  },
  emptyText: {
    fontSize: "14px",
    color: "#9089B5",
    lineHeight: 1.7,
    margin: 0,
    fontWeight: 700,
  },

  systemRow: {
    display: "flex",
    justifyContent: "center",
  },
  systemBubble: {
    fontSize: "13px",
    color: PURPLE_DARK,
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700,
    border: `2.5px solid ${PURPLE}40`,
    background: "#FFFFFF",
    borderRadius: "999px",
    padding: "8px 18px",
    textAlign: "center",
  },

  userRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: "10px",
  },
  userBubble: {
    background: `linear-gradient(135deg, ${PURPLE} 0%, #8C7AFF 100%)`,
    color: "#FFFFFF",
    padding: "13px 18px",
    borderRadius: "20px 20px 4px 20px",
    maxWidth: "68%",
    fontSize: "15px",
    lineHeight: 1.6,
    fontWeight: 700,
    border: `3px solid ${INK}`,
    boxShadow: `0 4px 0 ${INK}`,
  },
  userAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: YELLOW,
    border: `3px solid ${INK}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    flexShrink: 0,
    boxShadow: `0 3px 0 ${INK}`,
  },

  botRow: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    gap: "10px",
  },
  botAvatar: {
    flexShrink: 0,
  },
  botBubble: {
    background: CREAM,
    color: INK,
    padding: "14px 18px",
    borderRadius: "20px 20px 20px 4px",
    maxWidth: "70%",
    fontSize: "15px",
    lineHeight: 1.65,
    fontWeight: 600,
    border: `3px solid ${INK}`,
    boxShadow: `0 4px 0 ${INK}`,
  },

  typingRow: {
    display: "flex",
    gap: "6px",
    padding: "4px 2px",
  },
  dot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: PURPLE,
    display: "inline-block",
    animation: "bounceDot 1.2s infinite ease-in-out",
  },

  /* Input */
  inputArea: {
    padding: "18px 32px 22px",
    borderTop: `3px solid ${INK}`,
    backgroundColor: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(6px)",
  },
  inputBox: {
    display: "flex",
    gap: "10px",
    backgroundColor: "#FFFFFF",
    border: `3px solid ${INK}`,
    borderRadius: "20px",
    padding: "10px 10px 10px 18px",
    alignItems: "flex-end",
    boxShadow: `0 4px 0 ${INK}33`,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    border: "none",
    outline: "none",
    resize: "none",
    color: INK,
    fontSize: "15px",
    lineHeight: 1.5,
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 700,
    padding: "8px 0",
    maxHeight: "140px",
  },
  sendBtn: {
    background: `linear-gradient(135deg, ${MINT} 0%, #00B894 100%)`,
    border: `3px solid ${INK}`,
    borderRadius: "14px",
    color: "#FFFFFF",
    width: "44px",
    height: "44px",
    cursor: "pointer",
    fontSize: "18px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 4px 0 #008C6E`,
  },
  inputHint: {
    fontSize: "11.5px",
    color: "#B7AED9",
    textAlign: "center",
    marginTop: "12px",
    fontWeight: 700,
  },
};

export default App;