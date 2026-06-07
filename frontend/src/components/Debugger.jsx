import React, { useState, useEffect } from "react";
import { 
  Terminal, Database, Edit, RefreshCw, CheckCircle, Play, Activity, 
  ChevronRight, Clock, Code, Shield, Key, Settings, UserPlus
} from "lucide-react";

export default function Debugger({ activeTrace, backendUrl, token }) {
  const [prompts, setPrompts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [editedPromptText, setEditedPromptText] = useState("");
  const [activeTab, setActiveTab] = useState("pipeline"); // "pipeline" | "prompts" | "logs"
  const [isLoading, setIsLoading] = useState(false);
  const [notif, setNotif] = useState("");
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0); // Track selected trace node

  const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

  useEffect(() => {
    fetchSystemStatus();
    fetchPrompts();
    fetchLogs();
  }, [backendUrl, token]);

  // Reset selected node index when activeTrace changes
  useEffect(() => {
    setSelectedNodeIndex(0);
  }, [activeTrace]);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/developer/status`);
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/developer/prompts`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/developer/logs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePrompt = async () => {
    if (!selectedPrompt) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/developer/prompts/${selectedPrompt.agent_name}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ system_prompt: editedPromptText })
      });
      if (res.ok) {
        setNotif(`Prompt for ${selectedPrompt.agent_name} successfully updated to next version!`);
        fetchPrompts();
        fetchLogs();
        setTimeout(() => setNotif(""), 4000);
      } else {
        const err = await res.json();
        alert(`Error updating: ${err.detail || "Server error"}`);
      }
    } catch (e) {
      alert("Failed to reach server.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectPromptToEdit = (p) => {
    setSelectedPrompt(p);
    setEditedPromptText(p.system_prompt);
  };

  const getLogIcon = (action) => {
    if (action.includes("LOGIN")) return <Key className="w-3.5 h-3.5 text-brand-indigo" />;
    if (action.includes("SIGNUP")) return <UserPlus className="w-3.5 h-3.5 text-brand-emerald" />;
    if (action.includes("UPDATE")) return <Settings className="w-3.5 h-3.5 text-brand-purple" />;
    if (action.includes("EXECUTE")) return <Activity className="w-3.5 h-3.5 text-brand-amber" />;
    return <Shield className="w-3.5 h-3.5 text-slate-400" />;
  };

  const activeNode = activeTrace && activeTrace.length > 0 ? activeTrace[selectedNodeIndex] : null;

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col relative overflow-hidden border border-brand-purple/20">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/5 rounded-full filter blur-3xl -z-10"></div>
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="text-brand-purple w-5 h-5 animate-pulse" />
          <h2 className="text-base font-black tracking-tight text-white uppercase">Agent Debugger Console</h2>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-purple/20 text-brand-purple border border-brand-purple/30 uppercase tracking-wide">Sandbox Sandbox</span>
        </div>
        
        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-[10px] font-semibold">
          <button 
            onClick={() => setActiveTab("pipeline")}
            className={`px-3 py-1 rounded-md transition ${activeTab === "pipeline" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
          >
            Pipeline Trace
          </button>
          <button 
            onClick={() => setActiveTab("prompts")}
            className={`px-3 py-1 rounded-md transition ${activeTab === "prompts" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
          >
            Agent Prompts
          </button>
          <button 
            onClick={() => { setActiveTab("logs"); fetchLogs(); }}
            className={`px-3 py-1 rounded-md transition ${activeTab === "logs" ? "bg-brand-purple text-white" : "text-slate-400 hover:text-white"}`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* System Status Banner */}
      {systemStatus && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10px] shrink-0 select-none">
          <div className="flex items-center gap-2">
            <Activity className="text-brand-emerald w-3.5 h-3.5" />
            <span className="text-slate-400">Server Status:</span>
            <span className="text-brand-emerald font-semibold uppercase">{systemStatus.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">LLM Engine:</span>
            {systemStatus.gemini_api_key_configured ? (
              <span className="text-brand-emerald font-bold">Gemini 2.5 Flash (Production Live)</span>
            ) : (
              <span className="text-brand-amber font-bold">Deterministic Simulation Mode</span>
            )}
          </div>
          <button 
            onClick={() => { fetchSystemStatus(); fetchPrompts(); }}
            className="p-1 hover:bg-white/10 rounded transition text-slate-400 hover:text-white"
            title="Refresh logs & status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dynamic Tab Contents */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col min-h-0">
        
        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            <p className="text-[10px] text-slate-400 leading-normal select-none">
              Real-time audit chain for the multi-agent pipeline of the active chat. Select a node to review precise agent trace parameters.
            </p>
            
            {!activeTrace || activeTrace.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-2xl select-none">
                <Play className="text-slate-500 w-8 h-8 mb-2 animate-bounce" />
                <p className="text-xs text-slate-400 font-bold">No active trace payload detected.</p>
                <p className="text-[10px] text-slate-500 mt-1">Send a message in the consultation chat to trigger the advisor pipeline.</p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0 items-stretch">
                {/* Visual Graph Nodes */}
                <div className="xl:col-span-5 space-y-3 relative pl-4 before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-brand-purple before:to-brand-indigo overflow-y-auto">
                  {activeTrace.map((node, index) => {
                    const isSelected = selectedNodeIndex === index;
                    return (
                      <div 
                        key={index} 
                        onClick={() => setSelectedNodeIndex(index)}
                        className="flex gap-4 items-start relative cursor-pointer group select-none"
                      >
                        {/* Dot indicator */}
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 text-[9px] font-black transition-all ${isSelected ? "bg-brand-purple text-white ring-4 ring-brand-purple/20 scale-110" : "bg-slate-700 text-slate-400 group-hover:bg-slate-600"}`}>
                          {index + 1}
                        </div>
                        {/* Node Card */}
                        <div className={`flex-1 glass-card p-3 rounded-xl border transition ${isSelected ? "border-brand-purple bg-brand-purple/10" : "border-white/5 hover:border-white/10"}`}>
                          <div className="flex justify-between items-center mb-1">
                            <h4 className={`font-bold text-xs ${isSelected ? "text-brand-purple" : "text-white"}`}>{node.agent}</h4>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-brand-emerald font-semibold flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {node.latency_ms} ms
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-xs xl:max-w-[180px]">
                            {typeof node.output === "object" ? JSON.stringify(node.output) : node.output}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inspect Details */}
                <div className="xl:col-span-7 flex flex-col min-h-0 bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="bg-white/5 px-4 py-2.5 border-b border-white/5 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <Code className="w-3.5 h-3.5 text-brand-purple" />
                      {activeNode ? `${activeNode.agent} State Payload` : "Node Inspector"}
                    </span>
                    {activeNode && (
                      <span className="text-[9px] font-mono text-slate-500">Latency: {activeNode.latency_ms}ms</span>
                    )}
                  </div>
                  
                  {activeNode ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[10px] text-brand-emerald leading-relaxed">
                      <div>
                        <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wider block mb-1">Agent Input Parameters</span>
                        <pre className="p-3 bg-black/40 rounded-xl overflow-x-auto border border-white/5 max-h-48">
                          {typeof activeNode.input === "object" ? JSON.stringify(activeNode.input, null, 2) : activeNode.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wider block mb-1">Agent Output Results</span>
                        <pre className="p-3 bg-black/40 rounded-xl overflow-x-auto border border-white/5 max-h-60">
                          {typeof activeNode.output === "object" ? JSON.stringify(activeNode.output, null, 2) : activeNode.output}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs select-none">
                      Select a pipeline node to inspect execution variables.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROMPTS TAB */}
        {activeTab === "prompts" && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {notif && (
              <div className="p-2.5 bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 text-xs rounded-xl font-bold flex items-center gap-2 shrink-0 animate-fade-in">
                <CheckCircle className="w-4 h-4" />
                {notif}
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 items-stretch">
              {/* Prompt List */}
              <div className="lg:col-span-1 space-y-2 overflow-y-auto pr-1 select-none">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Prompt Registry</h3>
                {prompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPromptToEdit(p)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition flex flex-col gap-1 ${selectedPrompt?.id === p.id ? "bg-brand-purple/10 border-brand-purple text-white font-semibold" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"}`}
                  >
                    <span className="font-bold text-white capitalize">{p.agent_name.replace("_", " ")}</span>
                    <div className="flex justify-between w-full text-[9px] text-slate-500 mt-1">
                      <span>Version {p.version}</span>
                      <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Prompt Editor */}
              <div className="lg:col-span-2 flex flex-col min-h-0">
                {selectedPrompt ? (
                  <div className="flex-1 flex flex-col min-h-0 glass-card p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center mb-3 shrink-0 select-none">
                      <h3 className="text-xs font-bold text-white capitalize">
                        Edit Prompt Configuration
                      </h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/30 uppercase font-semibold">
                        Version {selectedPrompt.version} Active
                      </span>
                    </div>
                    <textarea
                      value={editedPromptText}
                      onChange={(e) => setEditedPromptText(e.target.value)}
                      className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] font-mono focus:outline-none focus:border-brand-purple/60 text-slate-300 resize-none min-h-48 mb-3"
                    />
                    <div className="flex justify-end gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedPrompt(null)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdatePrompt}
                        disabled={isLoading}
                        className="px-4 py-2 bg-brand-purple hover:bg-brand-purple/85 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                        Save Prompt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-white/5 rounded-2xl select-none">
                    <Edit className="w-8 h-8 mb-2" />
                    <p className="text-xs font-bold">Select an agent prompt from registry</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Loads system configurations for edits.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === "logs" && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1 shrink-0 select-none">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Audit & Security Ledger</h3>
              <button 
                onClick={fetchLogs}
                className="text-[10px] text-brand-purple flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Refresh logs
              </button>
            </div>
            
            {logs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-16 text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">No transaction audits found in database.</div>
            ) : (
              <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-black/10 min-h-0">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-white/5 text-slate-500 font-semibold border-b border-white/5 select-none">
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Audit Payload Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition">
                        <td className="p-2.5 font-mono text-[9px] text-slate-500">#{log.id}</td>
                        <td className="p-2.5 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono inline-flex items-center gap-1 ${log.action.startsWith("USER") ? "bg-brand-indigo/15 text-brand-indigo" : log.action.startsWith("UPDATE") ? "bg-brand-purple/15 text-brand-purple" : "bg-brand-emerald/15 text-brand-emerald"}`}>
                            {getLogIcon(log.action)}
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2.5 max-w-sm truncate font-mono text-[9px] text-slate-400" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
