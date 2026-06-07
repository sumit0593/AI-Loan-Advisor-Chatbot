import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare, User, ShieldAlert, FileText, Mic, MicOff, Info,
  Trash2, Plus, Sparkles, LogOut, ChartPie, TrendingUp, Calendar,
  ArrowRight, BookOpen, Layers, CheckCircle2, ChevronRight, Terminal, Printer,
  Menu, X, Check, DollarSign, Wallet, ShieldCheck, HelpCircle, Activity, Pin
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import Debugger from "./components/Debugger";
import { CanvasRevealEffect } from "./components/CanvasRevealEffect";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const PRODUCT_CATALOG = {
  "Personal Loan": { description: "General personal finance needs." },
  "Salary Advance": { description: "Short-term salary bridge." },
  "SME Loan": { description: "Business scale-up and equipment financing." },
  "BNPL": { description: "Interest-free short-term merchant credit." },
  "Secured Loan": { description: "Lower rate backed by assets/collateral." }
};

const Meteors = ({ number = 15 }) => {
  const meteors = new Array(number).fill(true);
  return (
    <>
      {meteors.map((el, idx) => (
        <span
          key={"meteor" + idx}
          className="animate-meteor absolute top-1/2 left-1/2 h-0.5 w-0.5 rounded-[9999px] bg-slate-400 shadow-[0_0_0_1px_ffffff10] rotate-[215deg] before:content-[''] before:absolute before:top-1/2 before:transform before:-translate-y-[50%] before:w-[50px] before:h-[1px] before:bg-gradient-to-r before:from-slate-500 before:to-transparent"
          style={{
            top: 0,
            left: Math.floor(Math.random() * 600) - 200 + "px",
            animationDelay: Math.random() * (0.8 - 0.2) + 0.2 + "s",
            animationDuration: Math.floor(Math.random() * (10 - 2) + 2) + "s",
          }}
        ></span>
      ))}
    </>
  );
};

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [isLoginView, setIsLoginView] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [hovered, setHovered] = useState(false);

  // Chat State
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [language, setLanguage] = useState("english"); // "english" | "hindi" | "hinglish"
  const [isTyping, setIsTyping] = useState(false);
  const [activeTrace, setActiveTrace] = useState([]);

  // Voice Recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Layout View Controls
  const [showDebugger, setShowDebugger] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "comparison"
  const [compareIndex, setCompareIndex] = useState(0); // For comparing scenarios
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [chartType, setChartType] = useState("area"); // "area" | "bar"

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dynamic Calculator States (Simulator)
  const [customAmount, setCustomAmount] = useState(100000);
  const [customRate, setCustomRate] = useState(10.5);
  const [customTenure, setCustomTenure] = useState(24);

  const chatEndRef = useRef(null);

  // Initialize browser voice recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language === "hindi" ? "hi-IN" : "en-US";

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setInputValue(text);
        setIsListening(false);
        // Automatically send the voice message
        handleSendMessage(text);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [language]);

  // Adjust language parameter in recognition dynamically
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language === "hindi" ? "hi-IN" : "en-US";
    }
  }, [language]);

  // Fetch active sessions upon logging in
  useEffect(() => {
    if (token) {
      fetchSessions();
    }
  }, [token]);

  // Auto-scroll chat feed
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Sync simulator sliders with active loan data recommendation
  const loanData = (() => {
    if (!activeTrace || activeTrace.length === 0) return null;

    const extractorStep = activeTrace.find(t => t.agent === "Profile Extractor");
    const eligibilityStep = activeTrace.find(t => t.agent === "Eligibility Engine");
    const recommendationStep = activeTrace.find(t => t.agent === "Recommendation Engine");
    const emiStep = activeTrace.find(t => t.agent === "EMI Math Tool");
    const complianceStep = activeTrace.find(t => t.agent === "Compliance Guardrail");

    if (!extractorStep || !recommendationStep || !emiStep) return null;

    return {
      profile: extractorStep.output,
      eligibility: eligibilityStep ? eligibilityStep.output : null,
      recommendation: recommendationStep.output,
      emi: emiStep.output,
      compliance: complianceStep ? complianceStep.output : { complianceApproved: true, warnings: [] }
    };
  })();

  useEffect(() => {
    if (loanData) {
      setCustomAmount(loanData.amount || 100000);
      setCustomRate(loanData.emi.rate_applied || 10.5);
      setCustomTenure(loanData.emi.tenure || 24);
    }
  }, [loanData ? loanData.amount : null, loanData ? loanData.emi.rate_applied : null, loanData ? loanData.emi.tenure : null]);

  // ----------------- API INTEGRATION -----------------

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          handleSelectSession(data[0].id);
        }
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSession = async (id) => {
    setActiveSessionId(id);
    setActiveTrace([]);
    setIsSidebarOpen(false); // Close sidebar on mobile select
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);

        // Populate current trace from the latest assistant message trace data
        const assistantMsgs = data.filter(m => m.sender === "assistant" && m.traceData);
        if (assistantMsgs.length > 0) {
          setActiveTrace(assistantMsgs[assistantMsgs.length - 1].traceData);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSession = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "New Loan Consultation" })
      });
      if (res.ok) {
        const data = await res.json();
        setSessions([data, ...sessions]);
        setActiveSessionId(data.id);
        setMessages([]);
        setActiveTrace([]);
        setIsSidebarOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        if (activeSessionId === id) {
          if (updated.length > 0) {
            handleSelectSession(updated[0].id);
          } else {
            setActiveSessionId("");
            setMessages([]);
            setActiveTrace([]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (textToSend = inputValue) => {
    if (!textToSend.trim() || !activeSessionId) return;

    // Add user message locally
    const userMsg = {
      id: Date.now(),
      sender: "user",
      message: textToSend,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions/${activeSessionId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: textToSend, language })
      });

      if (res.ok) {
        const data = await res.json();
        // Extract text from JSON wrapper if present
        const cleanMessage = extractMessageText(data.message);
        setMessages(prev => [...prev, {
          id: data.id,
          sender: "assistant",
          message: cleanMessage,
          createdAt: data.createdAt,
          traceData: data.traceData,
          isNew: true  // Flag for streaming animation
        }]);
        if (data.traceData) {
          setActiveTrace(data.traceData);
        }

        // Refresh session titles in sidebar
        if (data.updatedSessionTitle) {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: data.updatedSessionTitle } : s));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  // ----------------- VOICE & SPEECH FUNCTION -----------------

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // ----------------- AUTHENTICATION FLOW -----------------

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = isLoginView ? "/api/auth/login" : "/api/auth/signup";

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          email: authEmail,
          password: authPassword
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (isLoginView) {
          localStorage.setItem("token", data.accessToken);
          localStorage.setItem("user", JSON.stringify(data.user));
          setToken(data.accessToken);
          setUser(data.user);
        } else {
          setIsLoginView(true);
          setAuthError("Registration successful! Please log in.");
          setAuthPassword("");
        }
      } else {
        const err = await res.json();
        setAuthError(err.detail || "Authentication failed.");
      }
    } catch (e) {
      setAuthError("Failed to reach server. Please launch backend first.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setActiveSessionId("");
    setMessages([]);
    setSessions([]);
    setActiveTrace([]);
  };

  // ----------------- CALCULATIONS -----------------

  const calculateDynamicEMI = (principal, annualRate, months) => {
    if (!principal || !months) return { emi: 0, interest: 0, repayment: 0 };
    if (annualRate === 0) {
      return { emi: Math.round(principal / months), interest: 0, repayment: Math.round(principal) };
    }
    const r = annualRate / 12 / 100;
    const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    const repayment = emi * months;
    const interest = repayment - principal;
    return {
      emi: Math.round(emi),
      interest: Math.round(interest),
      repayment: Math.round(repayment)
    };
  };

  const dynamicResult = calculateDynamicEMI(customAmount, customRate, customTenure);

  // Extract readable text from JSON responses (e.g. { summary: "..." })
  const extractMessageText = (raw) => {
    if (!raw) return "";
    // If it's already a plain string that doesn't look like JSON, return as-is
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) return raw;
    try {
      const parsed = JSON.parse(trimmed);
      // Check for common keys the backend may wrap markdown in
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.summary === "string") return parsed.summary;
        if (typeof parsed.message === "string") return parsed.message;
        if (typeof parsed.response === "string") return parsed.response;
        if (typeof parsed.text === "string") return parsed.text;
      }
      // If parsed but no known key, return original
      return raw;
    } catch {
      return raw;
    }
  };

  // Streaming typing effect component for assistant messages
  const StreamingMessage = ({ text, renderFn, onComplete }) => {
    const [displayedLength, setDisplayedLength] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const intervalRef = useRef(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
      if (!text) return;
      setDisplayedLength(0);
      setIsComplete(false);
      let currentIdx = 0;
      const totalLen = text.length;

      // Speed: stream ~15 chars per frame at 16ms interval
      const charsPerTick = Math.max(3, Math.ceil(totalLen / 200));

      intervalRef.current = setInterval(() => {
        currentIdx += charsPerTick;
        if (currentIdx >= totalLen) {
          currentIdx = totalLen;
          clearInterval(intervalRef.current);
          setIsComplete(true);
          // Notify parent to clear isNew so it doesn't re-trigger
          if (onCompleteRef.current) onCompleteRef.current();
        }
        setDisplayedLength(currentIdx);
      }, 16);

      return () => clearInterval(intervalRef.current);
    }, [text]);

    const visibleText = text ? text.slice(0, displayedLength) : "";
    return (
      <div className="space-y-1">
        {renderFn(visibleText)}
        {!isComplete && (
          <span className="inline-block w-1.5 h-3.5 bg-brand-purple rounded-sm animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    );
  };

  // Custom visual markdown formatter inside React
  const renderMessageContent = (text) => {
    if (!text) return null;

    const formatInlineText = (str) => {
      if (!str) return "";
      const parts = str.split(/\*\*([^*]+)\*\*/g);
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          return <strong key={index} className="text-white print:text-black font-bold">{part}</strong>;
        }
        const subParts = part.split(/`([^`]+)`/g);
        return subParts.map((subPart, subIndex) => {
          if (subIndex % 2 === 1) {
            return <code key={subIndex} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-brand-emerald text-[11px]">{subPart}</code>;
          }
          return subPart;
        });
      });
    };

    const lines = text.split("\n");
    const elements = [];
    let currentTable = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("|")) {
        const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const isSeparator = cells.every(c => c.replace(/[:-\s]/g, "") === "");

        if (isSeparator) continue;

        if (!currentTable) {
          currentTable = { headers: null, rows: [] };
        }

        if (!currentTable.headers) {
          currentTable.headers = cells;
        } else {
          currentTable.rows.push(cells);
        }

        const nextLine = lines[i + 1]?.trim() || "";
        if (!nextLine.startsWith("|")) {
          const tableObj = currentTable;
          currentTable = null;
          elements.push(
            <div key={`table-${i}`} className="my-3 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-inner print:border-gray-300 print:bg-white print:text-black">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-brand-purple/20 border-b border-white/10 print:bg-gray-100 print:border-gray-300">
                    {tableObj.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 font-bold text-white print:text-black uppercase tracking-wider">
                        {formatInlineText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-gray-200">
                  {tableObj.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/5 transition print:hover:bg-transparent">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-300 print:text-gray-800">
                          {formatInlineText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      if (line === "") {
        elements.push(<div key={`space-${i}`} className="h-2"></div>);
        continue;
      }

      if (line === "---" || line === "***" || line === "___") {
        elements.push(<hr key={`hr-${i}`} className="border-white/10 my-4 print:border-gray-300" />);
        continue;
      }

      if (line.startsWith("####")) {
        elements.push(
          <h4 key={`h4-${i}`} className="text-xs font-bold text-white print:text-slate-900 mt-3 mb-1 uppercase tracking-wide">
            {formatInlineText(line.replace(/^#{4}\s*/, ""))}
          </h4>
        );
        continue;
      }
      if (line.startsWith("###")) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-sm font-bold text-brand-purple print:text-slate-900 mt-4 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand-purple animate-pulse" />
            {formatInlineText(line.replace(/^#{3}\s*/, ""))}
          </h3>
        );
        continue;
      }
      if (line.startsWith("##")) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-base font-black text-white print:text-slate-900 mt-5 mb-2 uppercase tracking-wide border-b border-white/10 pb-1.5 print:border-gray-300">
            {formatInlineText(line.replace(/^#{2}\s*/, ""))}
          </h2>
        );
        continue;
      }
      if (line.startsWith("#")) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-lg font-black text-white print:text-black mt-4 mb-3 tracking-tight">
            {formatInlineText(line.replace(/^#\s*/, ""))}
          </h1>
        );
        continue;
      }

      if (line.startsWith(">")) {
        elements.push(
          <div key={`quote-${i}`} className="p-3 bg-brand-rose/10 print:bg-red-50 border-l-4 border-brand-rose print:border-red-600 rounded-r-xl text-xs my-3 flex items-start gap-2 shadow-md animate-fade-in-up">
            <ShieldAlert className="w-4 h-4 text-brand-rose shrink-0 mt-0.5" />
            <div className="text-slate-200 print:text-black font-medium leading-relaxed">
              {formatInlineText(line.replace(">", "").trim())}
            </div>
          </div>
        );
        continue;
      }

      if (line.startsWith("*") || line.startsWith("-")) {
        elements.push(
          <li key={`li-${i}`} className="text-xs text-slate-300 print:text-slate-800 ml-4 py-1 flex items-start gap-2 animate-fade-in-up">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple mt-1.5 shrink-0"></span>
            <span>{formatInlineText(line.substring(1).trim())}</span>
          </li>
        );
        continue;
      }

      elements.push(
        <p key={`p-${i}`} className="text-xs text-slate-300 print:text-slate-800 leading-relaxed mb-2 font-light">
          {formatInlineText(line)}
        </p>
      );
    }

    return elements;
  };

  const handlePrint = () => {
    window.print();
  };

  const dti = loanData ? Math.round((((loanData.profile.existingEMI || 0) + (loanData.emi.main_calculation.emi || 0)) / (loanData.profile.monthlyIncome || 1)) * 100) : 0;

  // Format data for chart
  const chartData = loanData ? loanData.emi.scenarios.map(sc => ({
    ...sc,
    principal: loanData.amount,
    total_payment: sc.total_repayment
  })) : [];

  return (
    <div className="min-h-screen bg-brand-dark relative flex flex-col antialiased print:bg-white print:h-auto">
      {/* Background ambient glow shapes */}
      <div className="ambient-glow-1 top-10 left-10 print:hidden"></div>
      <div className="ambient-glow-2 bottom-20 right-20 print:hidden"></div>

      {/* LOGIN OVERLAY PANEL */}
      {!token ? (
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex-1 flex items-center justify-center p-4 min-h-screen bg-black relative overflow-hidden w-full transition-all duration-300"
        >
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full absolute inset-0 z-0"
              >
                <CanvasRevealEffect
                  animationSpeed={5}
                  containerClassName="bg-transparent"
                  colors={[
                    [59, 130, 246],
                    [139, 92, 246],
                  ]}
                  opacities={[0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4, 1]}
                  dotSize={2}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Radial gradient mask for standard Aceternity reveal look */}
          <div className="absolute inset-0 [mask-image:radial-gradient(400px_at_center,white,transparent)] bg-black/40 pointer-events-none z-0" />

          {/* Spotlight / Radial Mask fallback background indicator */}
          {!hovered && (
            <div className="absolute inset-0 bg-radial-spotlight pointer-events-none z-0 transition-opacity duration-300"></div>
          )}

          {/* Large ambient blur background orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-purple/10 rounded-full filter blur-[120px] pointer-events-none z-0"></div>

          <div className="w-full max-w-md auth-glow-card p-8 relative overflow-hidden shadow-2xl z-10">
            {/* Animated floating meteors */}
            <Meteors number={25} />

            <div className="text-center mb-6 relative z-10">
              <div className="inline-flex p-3 bg-brand-purple/20 rounded-2xl text-brand-purple mb-3 border border-brand-purple/30 shadow-inner">
                <Sparkles className="w-8 h-8 animate-pulse text-brand-purple" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                AI Loan Advisor
              </h1>
              <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest font-semibold bg-gradient-to-r from-brand-purple to-brand-indigo bg-clip-text text-transparent">
                Multi-Agent Intelligent Lending Graph
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-brand-rose/10 border border-brand-rose/20 text-xs text-brand-rose rounded-xl font-semibold text-center flex items-center justify-center gap-1.5 animate-fade-in-up relative z-10">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-brand-purple"></span>
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 transition duration-300 input-focus-glow"
                  placeholder="borrower123"
                />
              </div>

              {!isLoginView && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-brand-purple"></span>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 transition duration-300 input-focus-glow"
                    placeholder="email@example.com"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-brand-purple"></span>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 transition duration-300 input-focus-glow"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-brand-purple to-brand-indigo hover:opacity-95 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-brand-purple/20 mt-2 text-xs uppercase tracking-wider shimmer-btn"
              >
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  {isLoginView ? "Sign In to Sandbox" : "Create Account"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </form>

            <div className="mt-6 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center text-xs text-zinc-400 relative z-10 hover:border-brand-purple/20 transition-all duration-300">
              {isLoginView ? (
                <p>
                  New to lending sandbox?{" "}
                  <button
                    type="button"
                    onClick={() => { setIsLoginView(false); setAuthError(""); }}
                    className="text-brand-purple hover:text-brand-indigo font-bold underline cursor-pointer transition ml-1 bg-transparent border-none p-0"
                  >
                    Register here
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setIsLoginView(true); setAuthError(""); }}
                    className="text-brand-purple hover:text-brand-indigo font-bold underline cursor-pointer transition ml-1 bg-transparent border-none p-0"
                  >
                    Sign In instead
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* MAIN APPLICATION WORKSPACE */
        <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible print:block">

          {/* Header Navigation Navbar */}
          <header className="glass-card border-b border-white/5 px-6 py-4 flex items-center justify-between z-10 shrink-0 select-none print:hidden">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition"
                title="Open Registry"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="p-2 bg-brand-purple/20 rounded-xl text-brand-purple border border-brand-purple/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-white text-base tracking-tight">AI Loan Advisor Sandbox</h1>
                <p className="text-[10px] text-slate-400">Secure Audit & Agent Execution Graph</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Language Selector */}
              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-[10px] font-semibold">
                <button
                  onClick={() => setLanguage("english")}
                  className={`px-2.5 py-1 rounded-md transition ${language === "english" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
                >
                  English
                </button>
                <button
                  onClick={() => setLanguage("hindi")}
                  className={`px-2.5 py-1 rounded-md transition ${language === "hindi" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
                >
                  हिंदी
                </button>
              </div>

              {/* Debug Toggle */}
              <button
                onClick={() => setShowDebugger(!showDebugger)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border ${showDebugger ? "bg-brand-purple/20 text-brand-purple border-brand-purple" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dev Trace Console</span>
              </button>

              {/* Logout */}
              <div className="flex items-center gap-3 pl-3 border-l border-white/10">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-white capitalize">{user?.username}</span>
                  <span className="text-[9px] text-slate-500 font-medium">Borrower</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-white/5 hover:bg-brand-rose/20 hover:text-brand-rose border border-white/10 rounded-xl text-slate-400 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* MAIN BODY DASHBOARD */}
          <div className="flex-1 flex overflow-hidden print:h-auto print:overflow-visible print:block relative">

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-30 md:hidden animate-fade-in"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* 1. SIDEBAR SESSIONS LISTING */}
            <motion.aside
              animate={{
                width: isMobile ? 256 : (isPinned ? 256 : 72),
                x: isMobile ? (isSidebarOpen ? 0 : -256) : 0
              }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 26
              }}
              className={`fixed inset-y-0 left-0 glass-card border-r border-white/5 py-4 flex flex-col gap-4 shrink-0 select-none print:hidden z-40 md:static md:flex overflow-x-hidden`}
              style={{
                paddingLeft: isMobile ? 16 : (isPinned ? 16 : 12),
                paddingRight: isMobile ? 16 : (isPinned ? 16 : 12)
              }}
            >
              {/* Desktop Branding Header with Pin/Unpin Toggle */}
              <div className={`hidden md:flex items-center overflow-hidden shrink-0 border-b border-white/5 pb-3 px-1 py-1.5 ${isPinned ? "justify-between" : "justify-center"}`}>
                {isPinned && (
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="p-1.5 bg-brand-purple/20 rounded-lg text-brand-purple shrink-0 border border-brand-purple/30">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <span className="font-bold text-white text-xs whitespace-nowrap overflow-hidden uppercase tracking-wider bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                      Advisor Graph
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setIsPinned(!isPinned)}
                  className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ${isPinned ? "bg-brand-purple/20 text-brand-purple border border-brand-purple/30" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5"}`}
                  title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
                >
                  <Pin className={`w-3.5 h-3.5 transition-transform duration-200 ${isPinned ? "rotate-0" : "rotate-45"}`} />
                </button>
              </div>

              {/* Mobile Sidebar Close Header */}
              <div className="flex md:hidden justify-between items-center pb-2 border-b border-white/5 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultations</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleCreateSession}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition hover-shine shrink-0"
                style={{
                  paddingLeft: (isMobile || isPinned) ? "0.75rem" : "0",
                  paddingRight: (isMobile || isPinned) ? "0.75rem" : "0"
                }}
              >
                <Plus className="w-4 h-4 text-brand-purple shrink-0" />
                <motion.span
                  animate={{ opacity: (isMobile || isPinned) ? 1 : 0, width: (isMobile || isPinned) ? "auto" : 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  New Consultation
                </motion.span>
              </button>

              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 pr-0.5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`w-full group p-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-2 border ${activeSessionId === s.id ? "bg-brand-purple/10 border-brand-purple/40 text-white" : "bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-white"}`}
                    style={{
                      justifyContent: (isMobile || isPinned) ? "space-between" : "center"
                    }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-4 h-4 text-brand-purple shrink-0" />
                      <motion.span
                        animate={{ opacity: (isMobile || isPinned) ? 1 : 0, width: (isMobile || isPinned) ? "auto" : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs font-semibold truncate whitespace-nowrap overflow-hidden"
                      >
                        {s.title}
                      </motion.span>
                    </div>
                    {(isMobile || isPinned) && (
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-brand-rose/20 rounded text-slate-500 hover:text-brand-rose transition"
                        title="Delete chat session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Sidebar Statistics summary */}
              <div className="mt-auto pt-4 border-t border-white/5 flex flex-col items-center shrink-0">
                {(isMobile || isPinned) ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full space-y-3"
                  >
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                        <Activity className="w-3.5 h-3.5 text-brand-purple" />
                        <span>Evaluation Metrics</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                          <span className="text-[8px] text-slate-500 block uppercase font-medium">Consults</span>
                          <span className="font-bold text-white">{sessions.length}</span>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                          <span className="text-[8px] text-slate-500 block uppercase font-medium">Status</span>
                          <span className="font-bold text-brand-emerald">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[8px] text-slate-500 text-center uppercase tracking-widest font-semibold opacity-70">
                      Sandbox Secure Session
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-1.5 cursor-pointer" title="View Metrics">
                    <div className="relative p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white border border-white/5 transition duration-200">
                      <Activity className="w-4 h-4 text-brand-purple animate-pulse" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand-emerald rounded-full border border-brand-dark"></span>
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>

            {/* 2. CORE WORKSPACE COLUMN GRID */}
            <main className="flex-1 flex overflow-hidden print:h-auto print:overflow-visible print:block">

              {/* IF CHAT EMPTY STATE */}
              {!activeSessionId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                  <div className="p-4 bg-brand-purple/10 rounded-full text-brand-purple mb-4 animate-pulse">
                    <MessageSquare className="w-12 h-12" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Initialize Consultation</h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Select a conversation history from the side registry or trigger a brand new evaluation flow.
                  </p>
                  <button
                    onClick={handleCreateSession}
                    className="mt-4 px-6 py-2.5 bg-brand-purple hover:bg-brand-purple/80 text-white text-xs font-bold rounded-xl transition hover-shine"
                  >
                    Start Consulting
                  </button>
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-full print:h-auto print:overflow-visible print:block">

                  {/* PRINT ONLY MAIN HEADER */}
                  <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
                    <div className="flex justify-between items-end">
                      <div>
                        <h1 className="text-2xl font-bold uppercase tracking-wide text-black">AI Loan Advisor Consultation Report</h1>
                        <p className="text-xs text-gray-500 mt-1">Multi-Agent Lending Evaluation & Advisory Report</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <div>Borrower: <strong className="text-black capitalize">{user?.username}</strong></div>
                        <div>Date: {new Date().toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  {/* CHAT PANEL COLUMN */}
                  <div className={`flex flex-col h-full relative overflow-hidden print:hidden ${showDebugger || loanData ? "lg:col-span-4" : "lg:col-span-8 lg:col-start-3"}`}>
                    {/* Spotlight / Radial Mask */}
                    <div className="absolute inset-0 bg-radial-spotlight pointer-events-none z-0"></div>

                    {/* CHAT PANE HEADER */}
                    <div className="relative z-10 px-4 py-3 bg-transparent flex items-center justify-between shrink-0 select-none print:hidden">
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="w-4 h-4 text-brand-purple shrink-0" />
                        <span className="text-xs font-bold text-white truncate">
                          {sessions.find(s => s.id === activeSessionId)?.title || "Active Consultation"}
                        </span>
                      </div>
                    </div>

                    {/* Print Only Section Title */}
                    <div className="hidden print:block mb-4">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-black border-b border-gray-300 pb-1">
                        1. Consultation Transcript
                      </h2>
                    </div>

                    {/* CHAT FEED CONTAINER */}
                    <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4 print:overflow-visible print:h-auto print:p-0 print:space-y-3">
                      {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4 select-none">
                          <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 text-brand-purple flex items-center justify-center mb-4 border border-brand-purple/30 glow-ring-purple">
                            <Sparkles className="w-6 h-6 animate-pulse text-brand-purple" />
                          </div>
                          <h3 className="text-base font-black text-white tracking-tight">How can I assist your lending today?</h3>
                          <p className="text-xs text-zinc-500 mt-1.5 max-w-xs leading-relaxed mb-6">
                            Provide your requested Loan Amount, Purpose, Monthly Income, and existing monthly EMIs to initiate a multi-agent evaluation scan.
                          </p>

                          {/* Interactive Query Suggestion Cards */}
                          <div className="grid grid-cols-1 gap-2.5 w-full max-w-md">
                            {[
                              {
                                title: "Evaluate ₹200k Personal Loan",
                                desc: "Simulate EMI and check suitability score",
                                query: "Evaluate a Personal Loan of 2,00,000 INR with a monthly income of 35,000 INR and no existing EMIs."
                              },
                              {
                                title: "Scan SME Scale-up Eligibility",
                                desc: "Qualify a business expansion package of ₹500k",
                                query: "Check eligibility for a 5,00,000 INR SME Loan with monthly business turnover of 80,000 INR."
                              },
                              {
                                title: "Consolidate Debt & Assess DTI",
                                desc: "Run a debt burden warning evaluation",
                                query: "Analyze a Personal Loan of 3,00,000 INR. My monthly income is 60,000 INR and I have an existing EMI of 25,000 INR."
                              }
                            ].map((card, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setInputValue(card.query);
                                  handleSendMessage(card.query);
                                }}
                                className="interactive-suggestion-card p-3.5 rounded-xl text-left flex items-start gap-3 hover-shine"
                              >
                                <div className="p-2 bg-brand-purple/15 rounded-lg text-brand-purple border border-brand-purple/20 shrink-0">
                                  <DollarSign className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white tracking-wide">{card.title}</h4>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">{card.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {messages.map((m) => (
                        <div key={m.id} className={`flex items-start gap-3 print:gap-2 print:my-2 animate-fade-in-up ${m.sender === "user" ? "flex-row-reverse" : ""}`}>
                          {/* Avatar */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 select-none print:w-6 print:h-6 print:rounded-lg print:border-gray-300 print:text-black print:bg-gray-100 ${m.sender === "user" ? "glow-ring-indigo bg-brand-indigo/25 text-brand-indigo" : "glow-ring-purple bg-brand-purple/25 text-brand-purple"}`}>
                            {m.sender === "user" ? <User className="w-4.5 h-4.5 print:w-3.5 print:h-3.5" /> : <Sparkles className="w-4.5 h-4.5 print:w-3.5 print:h-3.5 animate-pulse" />}
                          </div>
                          {/* Bubble */}
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs print:max-w-[95%] print:bg-white print:text-black print:border print:border-gray-200 print:shadow-none print:py-2 print:px-3 transform transition duration-300 hover:scale-[1.01] ${m.sender === "user" ? "bg-gradient-to-r from-brand-indigo/80 to-brand-purple/80 text-white border border-brand-indigo/40 shadow-xl shadow-brand-indigo/10" : "bg-zinc-950/70 border border-white/10 shadow-xl shadow-black/40 backdrop-blur-md"}`}>
                            {m.sender === "user" ? (
                              <p className="leading-relaxed whitespace-pre-wrap print:text-slate-800">{m.message}</p>
                            ) : m.isNew ? (
                              <StreamingMessage
                                text={m.message}
                                renderFn={renderMessageContent}
                                onComplete={() => {
                                  // Clear isNew flag so animation doesn't replay on re-renders
                                  setMessages(prev => prev.map(msg =>
                                    msg.id === m.id ? { ...msg, isNew: false } : msg
                                  ));
                                }}
                              />
                            ) : (
                              <div className="space-y-1">{renderMessageContent(m.message)}</div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Typing bubble */}
                      {isTyping && (
                        <div className="flex items-start gap-3 print:hidden">
                          <div className="w-8 h-8 rounded-xl bg-brand-purple/20 text-brand-purple flex items-center justify-center shrink-0 border border-brand-purple/30 glow-ring-purple">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                          </div>
                          <div className="bg-zinc-950/70 border border-white/10 rounded-2xl px-4 py-3 flex gap-1 items-center shadow-md">
                            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full typing-dot"></span>
                            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full typing-dot"></span>
                            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full typing-dot"></span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef}></div>
                    </div>

                    {/* INPUT FORM AND CONTROLS */}
                    <div className="relative z-10 p-4 bg-transparent shrink-0 print:hidden select-none">
                      <div className="flex gap-2 items-center">

                        {isListening ? (
                          <div className="flex-1 flex items-center justify-between bg-brand-rose/10 border border-brand-rose/40 rounded-xl px-4 py-2.5 shadow-lg shadow-brand-rose/5">
                            <span className="text-xs text-brand-rose font-bold animate-pulse flex items-center gap-1.5">
                              <Mic className="w-4 h-4 animate-bounce" /> Recording voice...
                            </span>
                            <div className="voice-wave-container">
                              <span className="voice-wave-bar"></span>
                              <span className="voice-wave-bar"></span>
                              <span className="voice-wave-bar"></span>
                              <span className="voice-wave-bar"></span>
                              <span className="voice-wave-bar"></span>
                            </div>
                            <button
                              onClick={toggleVoiceInput}
                              className="text-[10px] font-bold px-2.5 py-1 bg-brand-rose/25 hover:bg-brand-rose/35 text-brand-rose border border-brand-rose/30 rounded-lg transition"
                            >
                              Stop
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={toggleVoiceInput}
                              className="p-3 rounded-xl border bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white transition-all duration-300 shadow hover:scale-105 active:scale-95 flex items-center justify-center glow-ring-purple"
                              title="Speak to chatbot"
                            >
                              <Mic className="w-4 h-4" />
                            </button>

                            <div className="flex-1 relative rounded-xl border border-zinc-800 bg-zinc-900 chat-input-container-glow transition-all duration-300">
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                placeholder="Provide loan amount, income, employment..."
                                className="w-full bg-transparent px-4 py-3.5 pr-12 text-xs focus:outline-none text-white placeholder-zinc-500"
                              />
                              <button
                                onClick={() => handleSendMessage()}
                                className="absolute right-2 top-2 p-2 bg-gradient-to-r from-brand-purple to-brand-indigo text-white rounded-lg transition-all duration-300 shadow hover:opacity-95 hover:scale-105 active:scale-95 flex items-center justify-center"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>


                  {/* 3. DYNAMIC RIGHT INSPECTOR PANEL (DASHBOARD OR DEV DEBUGGER) */}
                  {(showDebugger || loanData) && (
                    <div className="lg:col-span-8 overflow-y-auto p-6 h-full space-y-6 print:col-span-12 print:w-full print:block print:p-0 print:bg-white print:text-black">

                      {/* DEV CONSOLE MODE TOGGLED OVERRIDE */}
                      {showDebugger && (
                        <div className="print:hidden h-full">
                          <Debugger
                            activeTrace={activeTrace}
                            backendUrl={BACKEND_URL}
                            token={token}
                          />
                        </div>
                      )}

                      {/* REAL-TIME LOAN ADVISORY DASHBOARD VIEW */}
                      {loanData && (
                        <div className={`space-y-6 print:space-y-4 ${showDebugger ? "hidden print:block" : ""}`}>

                          {/* Top Action Tabs */}
                          <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden select-none">
                            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-xs">
                              <button
                                onClick={() => setActiveTab("overview")}
                                className={`px-4 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${activeTab === "overview" ? "bg-brand-purple text-white shadow" : "text-slate-400 hover:text-white"}`}
                              >
                                <ChartPie className="w-3.5 h-3.5" />
                                Overview Dashboard
                              </button>
                              <button
                                onClick={() => setActiveTab("comparison")}
                                className={`px-4 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${activeTab === "comparison" ? "bg-brand-purple text-white shadow" : "text-slate-400 hover:text-white"}`}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                Dynamic Product Comparer
                              </button>
                            </div>

                            <button
                              onClick={handlePrint}
                              className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-semibold transition border border-white/10 flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Export PDF / Print
                            </button>
                          </div>

                          {/* Print Only Section Title */}
                          <div className="hidden print:block border-b border-gray-300 pb-2 mb-4">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                              Financial Analysis & Amortization Report
                            </h2>
                          </div>

                          {/* DASHBOARD TAB CONTENTS */}
                          {activeTab === "overview" && (
                            <div className="space-y-6 print:space-y-4">
                              {/* 1. MATCH BANNER METRICS */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-2">
                                <div className="bg-zinc-950 border border-zinc-800 hover:border-brand-purple/40 hover:shadow-lg hover:shadow-brand-purple/5 hover:scale-105 transition-all duration-300 p-4 rounded-2xl print:border print:border-gray-300 print:bg-gray-100 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">Recommended Product</span>
                                      <FileText className="w-4 h-4 text-brand-purple" />
                                    </div>
                                    <span className="text-sm font-bold text-white mt-2 block print:text-black">{loanData.recommendation.recommendedProduct?.name || "General Personal"}</span>
                                  </div>
                                  <span className="text-[10px] text-brand-emerald font-bold mt-2 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {loanData.recommendation.recommendedProduct?.suitabilityScore}% Matched
                                  </span>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 hover:border-brand-purple/40 hover:shadow-lg hover:shadow-brand-purple/5 hover:scale-105 transition-all duration-300 p-4 rounded-2xl print:border print:border-gray-300 print:bg-gray-100 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">Monthly installment (EMI)</span>
                                      <Calendar className="w-4 h-4 text-brand-indigo" />
                                    </div>
                                    <span className="text-base font-black text-brand-purple mt-2 block print:text-black">₹{loanData.emi.main_calculation.emi?.toLocaleString()}</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 mt-2 block font-semibold">Applied Rate: {loanData.emi.rate_applied}%</span>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 hover:border-brand-purple/40 hover:shadow-lg hover:shadow-brand-purple/5 hover:scale-105 transition-all duration-300 p-4 rounded-2xl print:border print:border-gray-300 print:bg-gray-100 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">Accumulated Interest</span>
                                      <TrendingUp className="w-4 h-4 text-brand-amber" />
                                    </div>
                                    <span className="text-base font-bold text-white mt-2 block print:text-black">₹{loanData.emi.main_calculation.interest?.toLocaleString()}</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 mt-2 block font-semibold">Over {loanData.emi.tenure} Months</span>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 hover:border-brand-purple/40 hover:shadow-lg hover:shadow-brand-purple/5 hover:scale-105 transition-all duration-300 p-4 rounded-2xl print:border print:border-gray-300 print:bg-gray-100 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">Compliance Check</span>
                                      <ShieldCheck className={`w-4 h-4 ${loanData.compliance.complianceApproved ? "text-brand-emerald" : "text-brand-rose"}`} />
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-3 ${loanData.compliance.complianceApproved ? "bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/20" : "bg-brand-rose/15 text-brand-rose border border-brand-rose/20"}`}>
                                      {loanData.compliance.complianceApproved ? "Fully Approved" : "Flags Alert"}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-zinc-500 block mt-2 font-medium">Audit System Check</span>
                                </div>
                              </div>

                              {/* 2. DYNAMIC DEBT-TO-INCOME SAFETY GAUGES */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">

                                {/* DTI GAUGE CARD */}
                                <div className="bg-zinc-950 relative overflow-hidden border border-zinc-800 p-5 rounded-3xl space-y-4 md:col-span-5 flex flex-col justify-between">
                                  <div className="absolute inset-0 bg-radial-spotlight pointer-events-none z-0 opacity-60"></div>
                                  <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-brand-emerald" />
                                        Debt Burden (DTI) Meter
                                      </h3>
                                      <p className="text-[9px] text-zinc-500 mt-0.5">
                                        Ratio of total monthly payments to earnings.
                                      </p>
                                    </div>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${dti <= 35 ? "bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/30" : dti <= 50 ? "bg-brand-amber/20 text-brand-amber border border-brand-amber/30" : "bg-brand-rose/20 text-brand-rose border border-brand-rose/30"}`}>
                                      {dti <= 35 ? "Safe" : dti <= 50 ? "Caution" : "High Risk"}
                                    </span>
                                  </div>

                                  <div className="relative z-10 flex items-center gap-4 justify-around py-2">
                                    {/* SVG arc meter */}
                                    <div className="relative w-24 h-14 flex items-center justify-center overflow-hidden shrink-0 select-none">
                                      <svg className="w-full h-full transform translate-y-1" viewBox="0 0 100 50">
                                        <path
                                          d="M 10 50 A 40 40 0 0 1 90 50"
                                          fill="none"
                                          stroke="rgba(255,255,255,0.06)"
                                          strokeWidth="10"
                                          strokeLinecap="round"
                                        />
                                        <path
                                          d="M 10 50 A 40 40 0 0 1 90 50"
                                          fill="none"
                                          stroke={dti <= 35 ? "#06d6a0" : dti <= 50 ? "#ffd166" : "#ef476f"}
                                          strokeWidth="10"
                                          strokeLinecap="round"
                                          strokeDasharray="125.6"
                                          strokeDashoffset={125.6 - (125.6 * Math.min(dti, 100)) / 100}
                                          className="transition-all duration-1000 ease-out"
                                        />
                                      </svg>
                                      <div className="absolute bottom-0 text-center">
                                        <span className="text-lg font-black text-white">{dti}%</span>
                                        <span className="text-[7px] text-zinc-500 block uppercase font-bold">DTI Index</span>
                                      </div>
                                    </div>

                                    {/* Small stats layout */}
                                    <div className="space-y-1.5 text-[10px]">
                                      <div className="flex justify-between gap-4 border-b border-white/5 pb-0.5">
                                        <span className="text-zinc-400">Monthly Obligations:</span>
                                        <span className="font-bold text-white">₹{((loanData.profile.existingEMI || 0) + (loanData.emi.main_calculation.emi || 0)).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between gap-4 border-b border-white/5 pb-0.5">
                                        <span className="text-zinc-400">Monthly Income:</span>
                                        <span className="font-bold text-white">₹{(loanData.profile.monthlyIncome || 0).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <p className="relative z-10 text-[9px] text-zinc-400 leading-relaxed pt-1">
                                    {dti <= 35
                                      ? "Excellent! Your obligations consume less than 35% of earnings. Highly sustainable credit profile."
                                      : dti <= 50
                                        ? "Moderate risk: Combined EMIs absorb up to 50% of your earnings. Take precaution."
                                        : "Warning: Debt burden is critically high. Monthly obligations consume over 50% of monthly earnings."}
                                  </p>
                                </div>

                                {/* TENURE TRADE-OFF COMPARATIVE ANALYSIS CHART CARD */}
                                <div className="bg-zinc-950 relative overflow-hidden border border-zinc-800 p-5 rounded-3xl space-y-4 md:col-span-7 print:border-0 print:shadow-none flex flex-col justify-between">
                                  <div className="absolute inset-0 bg-radial-spotlight pointer-events-none z-0 opacity-60"></div>
                                  <div className="relative z-10 flex justify-between items-center print:hidden">
                                    <div>
                                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-brand-purple" />
                                        Repayment Structure Comparative Analysis
                                      </h3>
                                      <p className="text-[9px] text-zinc-500 mt-0.5">
                                        Review how changes in amortization timelines reshape your interest and repayment cash obligations.
                                      </p>
                                    </div>
                                    <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-[9px] font-semibold shrink-0">
                                      <button
                                        onClick={() => setChartType("area")}
                                        className={`px-2 py-0.5 rounded transition ${chartType === "area" ? "bg-brand-purple text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                                      >
                                        Area
                                      </button>
                                      <button
                                        onClick={() => setChartType("bar")}
                                        className={`px-2 py-0.5 rounded transition ${chartType === "bar" ? "bg-brand-purple text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                                      >
                                        Bar (Stacked)
                                      </button>
                                    </div>
                                  </div>

                                  {/* Web Chart Rendering */}
                                  <div className="relative z-10 h-44 w-full print:hidden">
                                    <ResponsiveContainer width="100%" height="100%">
                                      {chartType === "area" ? (
                                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                          <defs>
                                            <linearGradient id="interestGlow" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#7b2cbf" stopOpacity={0.4} />
                                              <stop offset="95%" stopColor="#7b2cbf" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="emiGlow" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#4361ee" stopOpacity={0.4} />
                                              <stop offset="95%" stopColor="#4361ee" stopOpacity={0} />
                                            </linearGradient>
                                          </defs>
                                          <XAxis dataKey="tenure_months" stroke="#475569" fontSize={9} tickLine={false} />
                                          <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: "#121026", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px" }}
                                            labelStyle={{ color: "#a5b4fc", fontSize: 10, fontWeight: "bold" }}
                                            itemStyle={{ fontSize: 9 }}
                                          />
                                          <Area name="Interest Outlay (₹)" type="monotone" dataKey="total_interest" stroke="#7b2cbf" strokeWidth={2} fillOpacity={1} fill="url(#interestGlow)" />
                                          <Area name="Monthly EMI (₹)" type="monotone" dataKey="emi" stroke="#4361ee" strokeWidth={2} fillOpacity={1} fill="url(#emiGlow)" />
                                        </AreaChart>
                                      ) : (
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                          <XAxis dataKey="tenure_months" stroke="#475569" fontSize={9} tickLine={false} />
                                          <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: "#121026", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px" }}
                                            labelStyle={{ color: "#a5b4fc", fontSize: 10, fontWeight: "bold" }}
                                            itemStyle={{ fontSize: 9 }}
                                          />
                                          <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 8 }} />
                                          <Bar name="Principal Amount (₹)" dataKey="principal" fill="#4361ee" stackId="a" />
                                          <Bar name="Interest Component (₹)" dataKey="total_interest" fill="#7b2cbf" stackId="a" />
                                        </BarChart>
                                      )}
                                    </ResponsiveContainer>
                                  </div>

                                  {/* Printable static value list fallback for charts */}
                                  <div className="relative z-10 hidden print:block mt-4">
                                    <h4 className="text-xs font-bold border-b pb-1 mb-2">Simulated Repayment Schedules</h4>
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="py-2">Tenure Months</th>
                                          <th className="py-2">Monthly EMI Size</th>
                                          <th className="py-2">Accumulative Interest Outlay</th>
                                          <th className="py-2">Total Repayment Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {loanData.emi.scenarios.map((sc, index) => (
                                          <tr key={index}>
                                            <td className="py-2">{sc.tenure_months} Months</td>
                                            <td className="py-2">₹{sc.emi.toLocaleString()}</td>
                                            <td className="py-2">₹{sc.total_interest.toLocaleString()}</td>
                                            <td className="py-2">₹{sc.total_repayment.toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* 3. PRODUCT MATCHING CAROUSEL & REJECTIONS LOGS */}
                              {loanData.eligibility && (
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                      <Layers className="w-4 h-4 text-brand-purple" />
                                      Underwriting Eligibility & Product Scanning
                                    </h3>
                                    <p className="text-[9px] text-zinc-500 mt-0.5">
                                      Verify matching criteria and exclusions audited by the automated eligibility engines.
                                    </p>
                                  </div>

                                  {/* Eligible Products */}
                                  <div className="space-y-2">
                                    <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500">Qualifying Loan Vehicles</span>
                                    {loanData.eligibility.eligibleProducts.length === 0 ? (
                                      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-center text-xs text-zinc-500">
                                        No matching products found. Try raising income metrics or reducing request sizes.
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {loanData.eligibility.eligibleProducts.map((prod, idx) => {
                                          const isRecommended = prod.name === loanData.recommendation.recommendedProduct?.name;
                                          return (
                                            <div
                                              key={idx}
                                              className={`bg-zinc-950 border transition relative flex flex-col justify-between overflow-hidden group p-4 rounded-2xl hover:scale-105 duration-300 ${isRecommended ? "border-brand-purple/40 bg-brand-purple/5 shadow-brand-purple/5 shadow-md" : "border-zinc-800 hover:border-zinc-700"}`}
                                            >
                                              {isRecommended && (
                                                <div className="absolute top-0 right-0 bg-brand-purple text-white text-[7px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wide">
                                                  Best Match
                                                </div>
                                              )}
                                              <div>
                                                <span className="text-xs font-bold text-white block group-hover:text-brand-purple transition">{prod.name}</span>
                                                <span className="text-[10px] text-zinc-400 block mt-1">
                                                  Applied Rate: <strong className="text-brand-emerald">{prod.minRate}%</strong> (Min)
                                                </span>
                                                <span className="text-[10px] text-zinc-400 block">
                                                  Tenure Ceiling: <strong>{prod.maxTenure} Months</strong>
                                                </span>
                                              </div>
                                              <div className="mt-3 flex items-center justify-between text-[9px] text-zinc-500">
                                                <span className="capitalize italic">{PRODUCT_CATALOG[prod.name]?.description || "Available vehicle"}</span>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-brand-emerald" />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Rejected Products List */}
                                  {loanData.eligibility.rejectedProducts && loanData.eligibility.rejectedProducts.length > 0 && (
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                                      <details className="group">
                                        <summary className="p-3 flex justify-between items-center cursor-pointer text-xs font-semibold text-zinc-300 hover:text-white select-none">
                                          <span className="flex items-center gap-1.5 text-zinc-400">
                                            <ShieldAlert className="w-3.5 h-3.5 text-brand-rose" />
                                            Exclusion Audit logs ({loanData.eligibility.rejectedProducts.length} Products Screened Out)
                                          </span>
                                          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-zinc-500" />
                                        </summary>
                                        <div className="px-4 pb-4 space-y-2 border-t border-zinc-800 pt-3 bg-black/20">
                                          {loanData.eligibility.rejectedProducts.map((prod, idx) => (
                                            <div key={idx} className="p-2.5 bg-black/45 rounded-xl border border-zinc-800 text-[10px] flex justify-between items-start gap-4">
                                              <div>
                                                <span className="font-bold text-zinc-300 block">{prod.name}</span>
                                                <span className="text-zinc-500 block mt-0.5">{prod.reason}</span>
                                              </div>
                                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-brand-rose/10 text-brand-rose border border-brand-rose/20 uppercase tracking-wider shrink-0 mt-0.5">
                                                Disqualified
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 4. SAFETY COMPLIANCE WARNING CARD */}
                              {loanData.compliance.warnings.length > 0 && (
                                <div className="p-4 bg-brand-rose/10 border-l-4 border-brand-rose rounded-xl space-y-2 print:border print:border-red-400 print:bg-red-50">
                                  <div className="flex items-center gap-2 text-brand-rose">
                                    <ShieldAlert className="w-4 h-4" />
                                    <h4 className="text-xs font-bold uppercase tracking-wide">Responsible Lending & Compliance Alerts</h4>
                                  </div>
                                  <div className="space-y-1">
                                    {loanData.compliance.warnings.map((warn, wIdx) => (
                                      <p key={wIdx} className="text-xs text-zinc-300 leading-relaxed print:text-black">
                                        • {warn}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* DYNAMIC COMPARISON TAB */}
                          {activeTab === "comparison" && (
                            <div className="space-y-6">
                              <div>
                                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-brand-purple" />
                                  Interactive Refinement Simulator
                                </h3>
                                <p className="text-[9px] text-slate-500 mt-0.5">
                                  Manually scale loan values to dynamically stress test repayments. Verify parameters instantly against active compliance ratios.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                                {/* Sliders Panel */}
                                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-4 xl:col-span-5 flex flex-col justify-between relative overflow-hidden">
                                  <div className="space-y-4 relative z-10">
                                    {/* Slider 1 */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-zinc-400">Simulation Loan Amount</span>
                                        <span className="text-white font-bold">₹{customAmount.toLocaleString()}</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="10000"
                                        max="1500000"
                                        step="10000"
                                        value={customAmount}
                                        onChange={(e) => setCustomAmount(Number(e.target.value))}
                                        className="w-full accent-brand-purple cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                                      />
                                      <div className="flex justify-between text-[8px] text-zinc-600">
                                        <span>₹10,000</span>
                                        <span>₹1,500,000</span>
                                      </div>
                                    </div>

                                    {/* Slider 2 */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-zinc-400">Simulation Interest Rate (p.a.)</span>
                                        <span className="text-white font-bold">{customRate}%</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                        value={customRate}
                                        onChange={(e) => setCustomRate(Number(e.target.value))}
                                        className="w-full accent-brand-purple cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                                      />
                                      <div className="flex justify-between text-[8px] text-zinc-600">
                                        <span>0% (Interest Free)</span>
                                        <span>24% (Max Cap)</span>
                                      </div>
                                    </div>

                                    {/* Slider 3 */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-zinc-400">Simulation Amortization Tenure</span>
                                        <span className="text-white font-bold">{customTenure} Months</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="3"
                                        max="120"
                                        step="3"
                                        value={customTenure}
                                        onChange={(e) => setCustomTenure(Number(e.target.value))}
                                        className="w-full accent-brand-purple cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                                      />
                                      <div className="flex justify-between text-[8px] text-zinc-600">
                                        <span>3 Months</span>
                                        <span>120 Months (10 Yrs)</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="relative z-10 mt-4 p-3 bg-white/5 rounded-xl text-[9px] text-zinc-500 leading-normal border border-white/5 flex items-start gap-1.5">
                                    <Info className="w-3.5 h-3.5 text-brand-purple shrink-0 mt-0.5" />
                                    <span>These values allow manual calculations inside the sandbox and do not affect the main active model outputs.</span>
                                  </div>
                                </div>

                                {/* Dynamic Results Card */}
                                <div className="bg-zinc-950 relative overflow-hidden border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between xl:col-span-7">
                                  <div className="absolute inset-0 bg-radial-spotlight pointer-events-none z-0 opacity-60"></div>
                                  <div className="relative z-10 w-full">
                                    <h4 className="text-xs font-bold text-brand-purple uppercase tracking-wider mb-3">Simulation Amortization Result</h4>
                                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                                      <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                                        <span className="text-[8px] text-zinc-500 block uppercase font-semibold">Monthly EMI</span>
                                        <span className="text-xs font-black text-white">₹{dynamicResult.emi.toLocaleString()}</span>
                                      </div>
                                      <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                                        <span className="text-[8px] text-zinc-500 block uppercase font-semibold">Total Interest</span>
                                        <span className="text-xs font-black text-brand-purple">₹{dynamicResult.interest.toLocaleString()}</span>
                                      </div>
                                      <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                                        <span className="text-[8px] text-zinc-500 block uppercase font-semibold">Aggregate Outflow</span>
                                        <span className="text-xs font-black text-white">₹{dynamicResult.repayment.toLocaleString()}</span>
                                      </div>
                                    </div>

                                    <div className="space-y-2 divide-y divide-zinc-800/50">
                                      <div className="flex justify-between py-1.5 text-xs">
                                        <span className="text-zinc-400">Total Combined EMI (Existing + Simulated EMI)</span>
                                        <span className="text-white font-bold">₹{((loanData.profile.existingEMI || 0) + dynamicResult.emi).toLocaleString()} / mo</span>
                                      </div>
                                      <div className="flex justify-between py-1.5 text-xs">
                                        <span className="text-zinc-400">Simulated Debt burden (DTI Ratio)</span>
                                        {(() => {
                                          const simDTI = Math.round((((loanData.profile.existingEMI || 0) + dynamicResult.emi) / (loanData.profile.monthlyIncome || 1)) * 100);
                                          return (
                                            <span className={`font-bold ${simDTI <= 35 ? "text-brand-emerald" : simDTI <= 50 ? "text-brand-amber" : "text-brand-rose"}`}>
                                              {simDTI}% {simDTI > 50 ? "(Affordability Warning)" : "(Safe Limit)"}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="relative z-10 mt-4 border-t border-zinc-800 pt-4 w-full">
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Offered Tenure Scenarios comparative matrix</span>
                                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                      <table className="w-full text-left text-[10px] border-collapse">
                                        <thead>
                                          <tr className="bg-zinc-900/60 text-zinc-500 border-b border-zinc-800 font-semibold">
                                            <th className="p-2">Tenure Options</th>
                                            <th className="p-2">EMI Metric</th>
                                            <th className="p-2">Total Interest</th>
                                            <th className="p-2">Action</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/40">
                                          {loanData.emi.scenarios.map((sc, idx) => (
                                            <tr key={idx} className={`hover:bg-zinc-800/40 transition ${customTenure === sc.tenure_months ? "bg-brand-purple/10 text-white font-semibold" : "text-zinc-400"}`}>
                                              <td className="p-2">{sc.tenure_months} Months</td>
                                              <td className="p-2 text-white">₹{sc.emi.toLocaleString()}</td>
                                              <td className="p-2 text-brand-purple">₹{sc.total_interest.toLocaleString()}</td>
                                              <td className="p-2">
                                                <button
                                                  onClick={() => {
                                                    setCustomTenure(sc.tenure_months);
                                                  }}
                                                  className="px-2 py-0.5 bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/30 text-[9px] text-white rounded transition hover-shine"
                                                >
                                                  Select
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Print Disclaimer footer block */}
                          <div className="hidden print:block border-t border-gray-300 pt-4 mt-8 text-[10px] text-gray-500 italic text-center">
                            This document serves exclusively for sandbox visualization purposes. Actual loan decisions, interest structures, and terms rely strictly on physical audits and authentic credit checks by licensed entities.
                          </div>

                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
