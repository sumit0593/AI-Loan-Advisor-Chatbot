import React, { useState, useEffect } from "react";
import { Terminal, Database, Edit, RefreshCw, CheckCircle, Play, Activity } from "lucide-react";

export default function Debugger({ activeTrace, backendUrl, token }) {
  const [prompts, setPrompts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [editedPromptText, setEditedPromptText] = useState("");
  const [activeTab, setActiveTab] = useState("pipeline"); // "pipeline" | "prompts" | "logs"
  const [isLoading, setIsLoading] = useState(false);
  const [notif, setNotif] = useState("");

  const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

  useEffect(() => {
    fetchSystemStatus();
    fetchPrompts();
    fetchLogs();
  }, [backendUrl, token]);

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

  return (
    <div className="glass-card rounded-2xl p-6 h-full flex flex-col relative overflow-hidden border border-purple-500/20">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full filter blur-3xl -z-10"></div>
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5 mb-6">
        <div className="flex items-center gap-2">
          <Terminal className="text-brand-purple w-6 h-6 animate-pulse" />
          <h2 className="text-xl font-bold tracking-tight text-white">Agent Debugger Console</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-brand-purple/20 text-brand-purple border border-brand-purple/30">Admin Dev</span>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab("pipeline")}
            className={`px-3 py-1.5 rounded-lg text-sm transition font-medium ${activeTab === "pipeline" ? "bg-brand-purple text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            Pipeline Graph
          </button>
          <button 
            onClick={() => setActiveTab("prompts")}
            className={`px-3 py-1.5 rounded-lg text-sm transition font-medium ${activeTab === "prompts" ? "bg-brand-purple text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            Prompt Registry
          </button>
          <button 
            onClick={() => { setActiveTab("logs"); fetchLogs(); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition font-medium ${activeTab === "logs" ? "bg-brand-purple text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* System Status Banner */}
      {systemStatus && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="text-brand-emerald w-4 h-4" />
            <span className="text-slate-400">Server Status:</span>
            <span className="text-brand-emerald font-semibold uppercase">{systemStatus.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">LLM Endpoint:</span>
            {systemStatus.gemini_api_key_configured ? (
              <span className="text-brand-emerald font-semibold">Gemini 1.5 (Production Live)</span>
            ) : (
              <span className="text-brand-amber font-semibold">Deterministic Sandbox (Simulation Mode)</span>
            )}
          </div>
          <button 
            onClick={() => { fetchSystemStatus(); fetchPrompts(); }}
            className="p-1 hover:bg-white/10 rounded transition"
            title="Refresh logs & status"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      )}

      {/* Dynamic Tab Contents */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Real-time audit chain for the multi-agent pipeline of the active chat. Select a node to review precise agent trace parameters.
            </p>
            
            {!activeTrace || activeTrace.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-xl">
                <Play className="text-slate-500 w-8 h-8 mb-2 animate-bounce" />
                <p className="text-sm text-slate-500 font-medium">No active trace payload detected.</p>
                <p className="text-xs text-slate-600 mt-1">Send a message to prompt the advisor graph.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Visual Graph Nodes */}
                <div className="space-y-4 relative pl-4 before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-brand-purple before:to-brand-indigo">
                  {activeTrace.map((node, index) => (
                    <div key={index} className="flex gap-4 items-start relative">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 text-[10px] font-bold ${node.latency_ms > 0 ? "bg-brand-purple text-white ring-4 ring-brand-purple/20" : "bg-slate-700 text-slate-400"}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 glass-card p-4 rounded-xl border border-white/5 hover:border-brand-purple/30 transition">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-white text-sm">{node.agent}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 text-brand-emerald font-semibold">
                            ⚡ {node.latency_ms} ms
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-xs xl:max-w-md">
                          Input: {typeof node.input === "object" ? JSON.stringify(node.input) : node.input}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inspect Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-300">Raw Trace Payload Inspector</h3>
                  <div className="bg-black/40 p-4 rounded-xl font-mono text-[11px] overflow-auto h-96 border border-white/5 text-brand-emerald">
                    <pre>{JSON.stringify(activeTrace, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROMPTS TAB */}
        {activeTab === "prompts" && (
          <div className="space-y-6">
            {notif && (
              <div className="p-3 bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 text-xs rounded-lg font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {notif}
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Prompt List */}
              <div className="lg:col-span-1 space-y-2">
                <h3 className="text-sm font-bold text-slate-300 mb-2">Select Agent Prompt</h3>
                {prompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPromptToEdit(p)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition flex flex-col gap-1 ${selectedPrompt?.id === p.id ? "bg-brand-purple/10 border-brand-purple text-white font-medium" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"}`}
                  >
                    <span className="font-bold text-white capitalize">{p.agent_name.replace("_", " ")}</span>
                    <div className="flex justify-between w-full text-[10px] text-slate-500 mt-1">
                      <span>Version {p.version}</span>
                      <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Prompt Editor */}
              <div className="lg:col-span-2 space-y-4">
                {selectedPrompt ? (
                  <div className="space-y-4 glass-card p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white capitalize">
                        Edit: {selectedPrompt.agent_name.replace("_", " ")} Prompt
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                        Version {selectedPrompt.version} Active
                      </span>
                    </div>
                    <textarea
                      value={editedPromptText}
                      onChange={(e) => setEditedPromptText(e.target.value)}
                      className="w-full h-80 bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-brand-purple/60 text-slate-300 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedPrompt(null)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdatePrompt}
                        disabled={isLoading}
                        className="px-4 py-2 bg-brand-purple hover:bg-brand-purple/80 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                        Save as Next Version
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-600 border border-dashed border-white/5 rounded-xl">
                    <Edit className="w-8 h-8 mb-2" />
                    <p className="text-sm">Select an agent prompt from the left panel to update active settings.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-slate-300">Audit & Security Ledger</h3>
              <button 
                onClick={fetchLogs}
                className="text-xs text-brand-purple flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            
            {logs.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">No transaction audits found in database.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 font-semibold border-b border-white/5">
                      <th className="p-3">ID</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Audit Payload Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition text-slate-300">
                        <td className="p-3 font-mono text-[10px] text-slate-500">#{log.id}</td>
                        <td className="p-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${log.action.startsWith("USER") ? "bg-brand-indigo/15 text-brand-indigo" : log.action.startsWith("UPDATE") ? "bg-brand-purple/15 text-brand-purple" : "bg-brand-emerald/15 text-brand-emerald"}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 max-w-sm truncate font-mono text-[10px] text-slate-400" title={log.details}>
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
