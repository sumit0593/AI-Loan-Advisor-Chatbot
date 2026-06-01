import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, User, ShieldAlert, FileText, Mic, MicOff, Info, 
  Trash2, Plus, Sparkles, LogOut, ChartPie, TrendingUp, Calendar, 
  ArrowRight, BookOpen, Layers, CheckCircle2, ChevronRight, Terminal, Printer
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Debugger from "./components/Debugger";

const BACKEND_URL = "http://localhost:8000";

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [isLoginView, setIsLoginView] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

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
        setMessages(prev => [...prev, {
          id: data.id,
          sender: "assistant",
          message: data.message,
          createdAt: data.createdAt,
          traceData: data.traceData
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
          // Clear inputs
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

  // ----------------- PARSE ACTIVE GRAPH RESULT -----------------

  const getLoanParameters = () => {
    if (!activeTrace || activeTrace.length === 0) return null;
    
    const extractorStep = activeTrace.find(t => t.agent === "Profile Extractor");
    const recommendationStep = activeTrace.find(t => t.agent === "Recommendation Engine");
    const emiStep = activeTrace.find(t => t.agent === "EMI Math Tool");
    const complianceStep = activeTrace.find(t => t.agent === "Compliance Guardrail");

    if (!extractorStep || !recommendationStep || !emiStep) return null;

    return {
      profile: extractorStep.output,
      recommendation: recommendationStep.output,
      emi: emiStep.output,
      compliance: complianceStep ? complianceStep.output : { complianceApproved: true, warnings: [] }
    };
  };

  const loanData = getLoanParameters();

  // Custom visual markdown formatter inside React
  const renderMessageContent = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Table Header row format: | Heading 1 | Heading 2 |
      if (line.startsWith("|") && i < lines.length - 1 && lines[i+1].includes("---")) {
        return null; // Skip table header raw row
      }
      if (line.startsWith("|") && line.includes("---")) {
        return null; // Skip divisor row
      }
      
      // Standard Table Data row format: | Key | Value |
      if (line.startsWith("|")) {
        const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
        return (
          <div key={i} className="flex justify-between py-2 border-b border-white/5 print:border-gray-200 text-xs">
            <span className="text-slate-400 print:text-gray-600 font-medium">{cells[0]}</span>
            <span className="text-white print:text-black font-bold text-right">{cells[1]}</span>
          </div>
        );
      }

      // Main Headers
      if (line.startsWith("###")) {
        return <h3 key={i} className="text-sm font-bold text-brand-purple print:text-slate-900 mt-4 mb-2">{line.replace("###", "").trim()}</h3>;
      }
      if (line.startsWith("####")) {
        return <h4 key={i} className="text-xs font-bold text-white print:text-slate-900 mt-3 mb-1">{line.replace("####", "").trim()}</h4>;
      }

      // Warning block quotes
      if (line.startsWith(">")) {
        return (
          <div key={i} className="p-3 bg-brand-rose/10 print:bg-red-50 border-l-4 border-brand-rose print:border-red-600 rounded-r-lg text-xs my-3 text-slate-200 print:text-black">
            {line.replace(">", "").trim().replace("**", "").replace("**", "")}
          </div>
        );
      }

      // Bullet items
      if (line.startsWith("*") || line.startsWith("-")) {
        return (
          <li key={i} className="text-xs text-slate-300 print:text-slate-800 ml-4 list-disc py-0.5">
            {line.substring(1).trim()}
          </li>
        );
      }

      if (line.trim() === "") return <div key={i} className="h-2"></div>;

      // Regular paragraph text
      return (
        <p key={i} className="text-xs text-slate-300 print:text-slate-800 leading-relaxed mb-2">
          {line}
        </p>
      );
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-brand-dark relative flex flex-col antialiased print:bg-white print:h-auto">
      {/* Background ambient glow shapes */}
      <div className="ambient-glow top-10 left-10 print:hidden"></div>
      <div className="ambient-glow bottom-20 right-20 print:hidden"></div>

      {/* LOGIN OVERLAY PANEL */}
      {!token ? (
        <div className="flex-1 flex items-center justify-center p-4 min-h-screen">
          <div className="w-full max-w-md glass-card rounded-3xl p-8 relative border border-white/5 shadow-2xl">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand-purple/10 rounded-full filter blur-3xl"></div>
            
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-brand-purple/20 rounded-2xl text-brand-purple mb-3 border border-brand-purple/30">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">AI Loan Advisor</h1>
              <p className="text-sm text-slate-400 mt-1">Multi-Agent Intelligent Lending Graph</p>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-brand-rose/10 border border-brand-rose/20 text-xs text-brand-rose rounded-xl font-medium text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-white transition"
                  placeholder="borrower123"
                />
              </div>

              {!isLoginView && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-white transition"
                    placeholder="email@example.com"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-white transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-brand-purple to-brand-indigo hover:opacity-90 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-brand-purple/20 mt-2 text-sm"
              >
                {isLoginView ? "Sign In to Sandbox" : "Create Account"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              {isLoginView ? (
                <p>
                  New to lending sandbox?{" "}
                  <button 
                    onClick={() => { setIsLoginView(false); setAuthError(""); }}
                    className="text-brand-purple font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button 
                    onClick={() => { setIsLoginView(true); setAuthError(""); }}
                    className="text-brand-purple font-semibold hover:underline"
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
              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-xs">
                <button
                  onClick={() => setLanguage("english")}
                  className={`px-3 py-1 rounded-md transition font-medium ${language === "english" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
                >
                  English
                </button>
                <button
                  onClick={() => setLanguage("hindi")}
                  className={`px-3 py-1 rounded-md transition font-medium ${language === "hindi" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
                >
                  हिंदी
                </button>
              </div>

              {/* Debug Toggle */}
              <button
                onClick={() => setShowDebugger(!showDebugger)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${showDebugger ? "bg-brand-purple/20 text-brand-purple border-brand-purple" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Dev Trace Console</span>
              </button>

              {/* Logout */}
              <div className="flex items-center gap-3 pl-3 border-l border-white/10">
                <div className="hidden sm:flex flex-col text-right">
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
          <div className="flex-1 flex overflow-hidden print:h-auto print:overflow-visible print:block">
            
            {/* 1. SIDEBAR SESSIONS LISTING */}
            <aside className="w-64 glass-card border-r border-white/5 p-4 flex flex-col gap-4 shrink-0 select-none print:hidden hidden md:flex">
              <button
                onClick={handleCreateSession}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-4 h-4 text-brand-purple" />
                New Consultation
              </button>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`w-full group p-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 border ${activeSessionId === s.id ? "bg-brand-purple/10 border-brand-purple/40 text-white" : "bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-4 h-4 text-brand-purple shrink-0" />
                      <span className="text-xs font-medium truncate">{s.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-brand-rose/20 rounded text-slate-500 hover:text-brand-rose transition"
                      title="Delete chat session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>

            {/* 2. CORE WORKSPACE COLUMN GRID */}
            <main className="flex-1 flex overflow-hidden print:h-auto print:overflow-visible print:block">
              
              {/* IF CHAT EMPTY STATE */}
              {!activeSessionId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                  <div className="p-4 bg-brand-purple/10 rounded-full text-brand-purple mb-4">
                    <MessageSquare className="w-12 h-12" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Initialize Consultation</h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Select a conversation history from the side registry or trigger a brand new evaluation flow.
                  </p>
                  <button
                    onClick={handleCreateSession}
                    className="mt-4 px-6 py-2.5 bg-brand-purple hover:bg-brand-purple/80 text-white text-xs font-bold rounded-xl transition"
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
                        <p className="text-xs text-gray-500 mt-1">Multi-Agent Lending Evaluation & Chat History</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <div>Borrower: <strong className="text-black capitalize">{user?.username}</strong></div>
                        <div>Date: {new Date().toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* DYNAMIC LEFT OR RIGHT PANEL REDISTRIBUTION */}
                  <div className={`flex flex-col h-full border-r border-white/5 print:block print:w-full print:h-auto print:overflow-visible print:border-none ${showDebugger || loanData ? "lg:col-span-4" : "lg:col-span-8 lg:col-start-3"}`}>
                    
                    {/* CHAT PANE HEADER */}
                    <div className="px-4 py-3 border-b border-white/5 bg-black/20 flex items-center justify-between shrink-0 select-none print:hidden">
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="w-4 h-4 text-brand-purple shrink-0" />
                        <span className="text-xs font-bold text-white truncate">
                          {sessions.find(s => s.id === activeSessionId)?.title || "Active Consultation"}
                        </span>
                      </div>
                      <button
                        onClick={handlePrint}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
                        title="Print / Export Chat PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Print Only Section Title */}
                    <div className="hidden print:block mb-4">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-black border-b border-gray-300 pb-1">
                        1. Consultation Transcript
                      </h2>
                    </div>

                    {/* CHAT CHRONICLE INTERFACE */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 print:overflow-visible print:h-auto print:p-0 print:space-y-3">
                      {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 px-4">
                          <div className="w-10 h-10 rounded-full bg-brand-purple/20 text-brand-purple flex items-center justify-center mb-3">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-semibold text-white">How can I help you today?</h3>
                          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                            Provide your requested Loan Amount, Purpose, Monthly Inhand Income, and existing monthly EMI to initiate your multi-agent lending scan.
                          </p>
                        </div>
                      )}
                      
                      {messages.map((m) => (
                        <div key={m.id} className={`flex items-start gap-3 print:gap-2 print:my-2 ${m.sender === "user" ? "flex-row-reverse" : ""}`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border select-none print:w-6 print:h-6 print:rounded-lg print:border-gray-300 print:text-black print:bg-gray-100 ${m.sender === "user" ? "bg-brand-indigo/20 text-brand-indigo border-brand-indigo/30" : "bg-brand-purple/20 text-brand-purple border-brand-purple/30"}`}>
                            {m.sender === "user" ? <User className="w-4.5 h-4.5 print:w-3.5 print:h-3.5" /> : <Sparkles className="w-4.5 h-4.5 print:w-3.5 print:h-3.5" />}
                          </div>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs print:max-w-[95%] print:bg-white print:text-black print:border print:border-gray-200 print:shadow-none print:py-2 print:px-3 ${m.sender === "user" ? "bg-brand-indigo/20 text-slate-100 border border-brand-indigo/10" : "glass-card text-slate-200 border border-white/5 shadow-md"}`}>
                            {m.sender === "user" ? (
                              <p className="leading-relaxed whitespace-pre-wrap print:text-slate-800">{m.message}</p>
                            ) : (
                              <div className="space-y-1">{renderMessageContent(m.message)}</div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Typing bubble */}
                      {isTyping && (
                        <div className="flex items-start gap-3 print:hidden">
                          <div className="w-8 h-8 rounded-xl bg-brand-purple/20 text-brand-purple flex items-center justify-center shrink-0 border border-brand-purple/30">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="glass-card rounded-2xl px-4 py-3 flex gap-1 items-center shadow-md">
                            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full typing-dot"></span>
                            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full typing-dot"></span>
                            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full typing-dot"></span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef}></div>
                    </div>

                    {/* INPUT FORM AND CONTROLS */}
                    <div className="p-4 border-t border-white/5 bg-black/25 shrink-0 print:hidden select-none">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={toggleVoiceInput}
                          className={`p-3 rounded-xl border transition ${isListening ? "bg-brand-rose text-white border-brand-rose animate-pulse" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white"}`}
                          title={isListening ? "Listening... click to stop" : "Speak to chatbot"}
                        >
                          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                            placeholder={isListening ? "Listening voice..." : "Provide loan amount, income, employment..."}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-xs focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple text-white transition placeholder-slate-500"
                          />
                          <button
                            onClick={() => handleSendMessage()}
                            className="absolute right-2 top-2 p-1.5 bg-brand-purple text-white rounded-lg hover:opacity-90 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. DYNAMIC RIGHT INSPECTOR PANEL (DASHBOARD OR DEV DEBUGGER) */}
                  {(showDebugger || loanData) && (
                    <div className="lg:col-span-8 overflow-y-auto p-6 h-full space-y-6 print:col-span-12 print:w-full print:block print:p-0 print:bg-white print:text-black print-page-break">
                      
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
                                className={`px-4 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${activeTab === "overview" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
                              >
                                <ChartPie className="w-3.5 h-3.5" />
                                Overview Dashboard
                              </button>
                              <button
                                onClick={() => setActiveTab("comparison")}
                                className={`px-4 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${activeTab === "comparison" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
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
                              2. Financial Analysis & Amortization Report
                            </h2>
                          </div>

                          {/* DASHBOARD TAB CONTENTS */}
                          {activeTab === "overview" && (
                            <div className="space-y-6 print:space-y-4">
                              {/* 1. MATCH BANNER METRICS */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-2">
                                <div className="glass-card p-4 rounded-2xl border border-white/5 hover:border-brand-purple/20 transition print:border print:border-gray-300 print:bg-gray-100">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Product Recommended</span>
                                  <span className="text-base font-bold text-white mt-1 block print:text-black">{loanData.recommendation.recommendedProduct?.name || "General Personal"}</span>
                                  <span className="text-[10px] text-brand-emerald font-semibold mt-1 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {loanData.recommendation.recommendedProduct?.suitabilityScore}% Matched
                                  </span>
                                </div>
                                <div className="glass-card p-4 rounded-2xl border border-white/5 hover:border-brand-purple/20 transition print:border print:border-gray-300 print:bg-gray-100">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Monthly installment (EMI)</span>
                                  <span className="text-lg font-black text-brand-purple mt-0.5 block print:text-black">₹{loanData.emi.main_calculation.emi?.toLocaleString()}</span>
                                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">Applied Rate: {loanData.emi.rate_applied}%</span>
                                </div>
                                <div className="glass-card p-4 rounded-2xl border border-white/5 hover:border-brand-purple/20 transition print:border print:border-gray-300 print:bg-gray-100">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Accumulated Interest</span>
                                  <span className="text-base font-bold text-white mt-1 block print:text-black">₹{loanData.emi.main_calculation.interest?.toLocaleString()}</span>
                                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">Over {loanData.emi.tenure} Months</span>
                                </div>
                                <div className="glass-card p-4 rounded-2xl border border-white/5 hover:border-brand-purple/20 transition print:border print:border-gray-300 print:bg-gray-100">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Compliance Index</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-2 ${loanData.compliance.complianceApproved ? "bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/20" : "bg-brand-rose/15 text-brand-rose border border-brand-rose/20"}`}>
                                    {loanData.compliance.complianceApproved ? "Fully Approved" : "Flags Alert"}
                                  </span>
                                </div>
                              </div>

                              {/* 2. DYNAMIC AMORTIZATION / TENURE ANALYSIS CHART */}
                              <div className="glass-card p-5 rounded-3xl border border-white/5 space-y-4 print:border-0 print:shadow-none">
                                <div>
                                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5 print:text-black">
                                    <TrendingUp className="w-4 h-4 text-brand-purple" />
                                    Tenure Repayment Trade-Off Analysis
                                  </h3>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Compare cumulative interest cash outlays (lower values save money) against monthly EMI installment sizes at different tenures.
                                  </p>
                                </div>

                                <div className="h-60 w-full print:hidden">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={loanData.emi.scenarios} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                      <defs>
                                        <linearGradient id="interestGlow" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#7b2cbf" stopOpacity={0.4}/>
                                          <stop offset="95%" stopColor="#7b2cbf" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="emiGlow" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#4361ee" stopOpacity={0.4}/>
                                          <stop offset="95%" stopColor="#4361ee" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <XAxis dataKey="tenure_months" stroke="#475569" fontSize={10} tickLine={false} label={{ value: 'Tenure (Months)', position: 'insideBottom', offset: -5, fill: '#475569', fontSize: 10 }} />
                                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                                      <Tooltip 
                                        contentStyle={{ backgroundColor: "#1e1b4b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px" }}
                                        labelStyle={{ color: "#a5b4fc", fontSize: 11, fontWeight: "bold" }}
                                        itemStyle={{ fontSize: 10 }}
                                      />
                                      <Area name="Interest (₹)" type="monotone" dataKey="total_interest" stroke="#7b2cbf" strokeWidth={2} fillOpacity={1} fill="url(#interestGlow)" />
                                      <Area name="Monthly EMI (₹)" type="monotone" dataKey="emi" stroke="#4361ee" strokeWidth={2} fillOpacity={1} fill="url(#emiGlow)" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>

                                {/* Printable static value list fallback for charts */}
                                <div className="hidden print:block mt-4">
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

                              {/* 3. SAFETY COMPLIANCE WARNING CARD */}
                              {loanData.compliance.warnings.length > 0 && (
                                <div className="p-4 bg-brand-rose/10 border-l-4 border-brand-rose rounded-xl space-y-2 print:border print:border-red-400 print:bg-red-50">
                                  <div className="flex items-center gap-2 text-brand-rose">
                                    <ShieldAlert className="w-4 h-4" />
                                    <h4 className="text-xs font-bold uppercase tracking-wide">Responsible Lending & Compliance Alerts</h4>
                                  </div>
                                  <div className="space-y-1">
                                    {loanData.compliance.warnings.map((warn, wIdx) => (
                                      <p key={wIdx} className="text-xs text-slate-300 leading-relaxed print:text-black">
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
                                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-brand-purple" />
                                  Dynamic Scenario Compare Table
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Toggle tenure selections to evaluate how shifts in amortization timelines reshape your cash commitments.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <label className="block text-xs font-semibold text-slate-400">Select Compare Baseline Scenario</label>
                                  <div className="space-y-2">
                                    {loanData.emi.scenarios.map((sc, index) => (
                                      <button
                                        key={index}
                                        onClick={() => setCompareIndex(index)}
                                        className={`w-full text-left p-3 rounded-xl border text-xs transition flex justify-between items-center ${compareIndex === index ? "bg-brand-purple/15 border-brand-purple text-white font-bold" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"}`}
                                      >
                                        <span>Amortization Plan {index + 1} ({sc.tenure_months} Months)</span>
                                        <span>EMI: ₹{sc.emi.toLocaleString()}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                                  <div>
                                    <h4 className="text-xs font-bold text-brand-purple uppercase tracking-wider mb-3">Selected Plan Impact Assessment</h4>
                                    <div className="space-y-3 divide-y divide-white/5">
                                      <div className="flex justify-between py-2 text-xs">
                                        <span className="text-slate-400">Tenure Term</span>
                                        <span className="text-white font-bold">{loanData.emi.scenarios[compareIndex]?.tenure_months} Months</span>
                                      </div>
                                      <div className="flex justify-between py-2 text-xs">
                                        <span className="text-slate-400">Monthly installment</span>
                                        <span className="text-white font-bold">₹{loanData.emi.scenarios[compareIndex]?.emi.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between py-2 text-xs">
                                        <span className="text-slate-400">Total Lifetime Interest</span>
                                        <span className="text-brand-purple font-black">₹{loanData.emi.scenarios[compareIndex]?.total_interest.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between py-2 text-xs">
                                        <span className="text-slate-400">Aggregated Outflow</span>
                                        <span className="text-white font-bold">₹{loanData.emi.scenarios[compareIndex]?.total_repayment.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 p-3 bg-white/5 rounded-xl text-[10px] text-slate-400 leading-relaxed border border-white/5">
                                    <Info className="inline w-3 h-3 text-brand-purple mr-1 align-text-bottom" />
                                    Notice that selecting a {loanData.emi.scenarios[compareIndex]?.tenure_months}-month schedule alters interest burden by ₹{Math.abs(loanData.emi.main_calculation.interest - (loanData.emi.scenarios[compareIndex]?.total_interest || 0)).toLocaleString()} compared to recommended defaults.
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
