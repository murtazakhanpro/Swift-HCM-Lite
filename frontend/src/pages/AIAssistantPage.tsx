import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Sparkles,
  User,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  toolUsed?: string | null;
  toolData?: Record<string, any> | null;
  timestamp: string;
}

export const AIAssistantPage: React.FC = () => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      sender: "ai",
      text: `Hello ${user?.role === "Admin" ? "Executive Leader" : user?.role === "HR" ? "HR Partner" : "Team Member"}! I am **Swift-HCM Grounded Assistant**, backed by Google Gemini and real-time HCM database tools.

I can answer company policy questions, compute leave balances, analyze workforce headcount, check attendance rates, or audit punctuality anomalies. All answers are strictly grounded and scoped to your **${user?.role}** role permissions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickPrompts = {
    Admin: [
      "What is our company office timing & late penalty policy?",
      "Summarize current workforce headcount across departments",
      "Check today's attendance rate and punctuality",
      "Audit chronic attendance tardiness (>3 lates this month)",
      "What is the corporate payroll payout for latest cycle?",
    ],
    HR: [
      "Explain the late arrival grace period and half-day rules",
      "Show headcount distribution by department",
      "Which employees are flagged with attendance anomalies?",
      "How many leave days are configured for annual and sick leave?",
      "Lookup employee contact details for engineering",
    ],
    Employee: [
      "What is the office start time and grace period?",
      "How many annual and sick leave days do I have remaining?",
      "What is the policy regarding 3 late arrivals?",
      "Show my latest salary and compensation breakdown",
      "What are the upcoming company holidays?",
    ],
  }[user?.role || "Employee"] || [
    "What is the company policy?",
    "Check leave balances",
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading || !token) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/ai/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error("Unable to connect to AI Assistant service.");
      }

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.answer,
        toolUsed: data.tool_used,
        toolData: data.data,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Service error.";
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: `⚠️ **Error communicating with AI engine:** ${errText}. Please verify backend status.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatMarkdown = (content: string) => {
    // Simple fast safe markdown line parser
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      // Bold rendering
      let parsed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return (
          <li
            key={idx}
            style={{ marginLeft: "1.25rem", marginBottom: "0.25rem" }}
            dangerouslySetInnerHTML={{ __html: parsed.replace(/^[-•]\s*/, "") }}
          />
        );
      }
      if (line.trim() === "") {
        return <div key={idx} style={{ height: "0.5rem" }} />;
      }
      return (
        <p
          key={idx}
          style={{ marginBottom: "0.35rem" }}
          dangerouslySetInnerHTML={{ __html: parsed }}
        />
      );
    });
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", height: "calc(100vh - 4.5rem)", display: "flex", flexDirection: "column" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <Bot size={26} color="var(--swift-neon)" />
            Swift-HCM Executive AI Assistant
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            7 Grounded Tools • Role-Scoped Access ({user?.role}) • Powered by Gemini GenAI
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.65rem",
              borderRadius: 12,
              fontSize: "0.75rem",
              fontWeight: 700,
              backgroundColor: "rgba(179, 255, 33, 0.12)",
              color: "var(--swift-neon)",
              border: "1px solid rgba(179, 255, 33, 0.3)",
            }}
          >
            <Shield size={12} />
            RBAC Guard Active
          </span>
          <button
            onClick={() => setMessages(messages.slice(0, 1))}
            className="btn-swift-secondary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
            title="Clear Chat History"
          >
            <RefreshCw size={13} />
            Reset Chat
          </button>
        </div>
      </div>

      {/* Chat Messages Canvas */}
      <div
        className="swift-card"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "1rem",
          backgroundColor: "rgba(20, 22, 25, 0.6)",
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const isToolExpanded = expandedToolId === msg.id;

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                maxWidth: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.65rem",
                  maxWidth: isUser ? "85%" : "90%",
                  flexDirection: isUser ? "row-reverse" : "row",
                }}
              >
                {/* Avatar Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    backgroundColor: isUser ? "rgba(1, 90, 255, 0.2)" : "rgba(179, 255, 33, 0.15)",
                    border: isUser ? "1px solid var(--swift-blue)" : "1px solid var(--swift-neon)",
                    color: isUser ? "var(--swift-blue)" : "var(--swift-neon)",
                  }}
                >
                  {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    padding: "0.85rem 1.1rem",
                    borderRadius: 12,
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                    backgroundColor: isUser ? "rgba(1, 90, 255, 0.15)" : "rgba(28, 36, 39, 0.9)",
                    border: isUser ? "1px solid rgba(1, 90, 255, 0.35)" : "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                >
                  {/* Tool execution badge if present */}
                  {msg.toolUsed && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: 6,
                        backgroundColor: "rgba(179, 255, 33, 0.1)",
                        border: "1px solid rgba(179, 255, 33, 0.3)",
                        color: "var(--swift-neon)",
                        fontSize: "0.725rem",
                        fontWeight: 700,
                        marginBottom: "0.65rem",
                        cursor: "pointer",
                      }}
                      onClick={() => setExpandedToolId(isToolExpanded ? null : msg.id)}
                      title="Click to inspect tool response payload"
                    >
                      <Sparkles size={11} />
                      <span>Tool: {msg.toolUsed}</span>
                      {isToolExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  )}

                  {/* Expandable Raw Tool Data */}
                  {isToolExpanded && msg.toolData && (
                    <div
                      style={{
                        padding: "0.65rem",
                        borderRadius: 6,
                        backgroundColor: "#0d0f11",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "0.725rem",
                        fontFamily: "JetBrains Mono, monospace",
                        color: "#a0a5ad",
                        marginBottom: "0.75rem",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <pre style={{ margin: 0 }}>{JSON.stringify(msg.toolData, null, 2)}</pre>
                    </div>
                  )}

                  {/* Content body */}
                  <div>{formatMarkdown(msg.text)}</div>

                  {/* Timestamp */}
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      textAlign: isUser ? "right" : "left",
                      marginTop: "0.4rem",
                    }}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--swift-neon)", fontSize: "0.85rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(179, 255, 33, 0.15)",
                border: "1px solid var(--swift-neon)",
              }}
            >
              <Bot size={16} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={16} className="animate-pulse" />
              <span>Selecting tool & reasoning with Gemini...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.65rem", marginBottom: "0.5rem" }}>
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 20,
              fontSize: "0.75rem",
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--swift-neon)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <Lightbulb size={12} color="var(--swift-neon)" />
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
      >
        <input
          type="text"
          placeholder="Ask anything about policy, headcount, leave balances, compensation, or anomalies..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
          className="swift-input"
          style={{ flex: 1, padding: "0.75rem 1rem", fontSize: "0.9rem" }}
        />
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="btn-swift-primary"
          style={{
            padding: "0.75rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            opacity: loading || !inputValue.trim() ? 0.6 : 1,
          }}
        >
          <Send size={16} />
          Ask
        </button>
      </form>
    </div>
  );
};
