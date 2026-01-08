'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, RefreshCcw, Terminal, Brain, MessageSquare, 
  Zap, Sparkles, Menu, Layers, ChevronRight, Users, CheckCircle2, Circle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface AgentConfig {
  name: string;
  role: string;
  personality: string;
  style: string;
}

interface ScenarioConfig {
  name: string;
  description: string;
  opening_line: string;
}

interface MetaData {
  scenarios: Record<string, ScenarioConfig>;
  agents: Record<string, AgentConfig>;
}

// 一个会话的完整配置
interface SessionConfig {
  scenarioId: string;
  agentIds: string[]; // 选中的人物ID列表
  history: Message[];
}

interface Message {
  id: string;
  agentId: string; // 'context' 或 agentId
  content: string;
  thought?: string;
}

const STYLE_MAP: Record<string, { color: string; icon: React.ReactNode }> = {
  purple: { color: 'bg-purple-900/50 border-purple-500/50 text-purple-200', icon: <Brain className="w-4 h-4" /> },
  blue:   { color: 'bg-blue-900/50 border-blue-500/50 text-blue-200',     icon: <Zap className="w-4 h-4" /> },
  amber:  { color: 'bg-amber-900/50 border-amber-500/50 text-amber-200',   icon: <Sparkles className="w-4 h-4" /> },
  default:{ color: 'bg-zinc-800 border-zinc-600 text-zinc-300',            icon: <MessageSquare className="w-4 h-4" /> }
};

export default function LLMSociety() {
  // --- Data State ---
  const [meta, setMeta] = useState<MetaData | null>(null);
  
  // --- UI State ---
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // 当前选中的场景 ID（用于左侧高亮）
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  
  // 配置阶段：当前选中的 Agent IDs
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  // 运行阶段：Session Cache
  // Key = scenarioId (为了简化，每个场景只能存一个活跃 Session，切换场景即切换 Session)
  // 如果想支持同一场景不同人物配置，Key 需要更复杂，这里先简单对应
  const [sessions, setSessions] = useState<Record<string, SessionConfig>>({});

  const [isThinking, setIsThinking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch MetaData
  useEffect(() => {
    fetch('http://localhost:8000/meta')
      .then(res => res.json())
      .then(data => {
        setMeta(data);
        const sKeys = Object.keys(data.scenarios);
        if (sKeys.length > 0) setSelectedScenarioId(sKeys[0]);
      });
  }, []);

  // 当前活跃的 Session（如果已经创建了）
  const activeSession = selectedScenarioId ? sessions[selectedScenarioId] : null;
  const activeScenarioConfig = (selectedScenarioId && meta) ? meta.scenarios[selectedScenarioId] : null;

  // --- Scroll ---
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [sessions, selectedScenarioId, isThinking]);

  // --- Auto Play ---
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (autoPlay && !isThinking && activeSession) {
      timeout = setTimeout(handleNextTurn, 2000);
    }
    return () => clearTimeout(timeout);
  }, [autoPlay, isThinking, sessions, selectedScenarioId]);

  // --- Actions ---

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId) 
        : [...prev, agentId]
    );
  };

  const startSession = () => {
    if (!selectedScenarioId || !meta || selectedAgentIds.length < 2) return;
    
    const scenario = meta.scenarios[selectedScenarioId];
    
    // 初始化 Session
    const newSession: SessionConfig = {
      scenarioId: selectedScenarioId,
      agentIds: [...selectedAgentIds], // 快照
      history: [{
        id: 'init',
        agentId: 'context',
        content: `【SCENE】${scenario.name}\n${scenario.description}\n\n${scenario.opening_line}`
      }]
    };

    setSessions(prev => ({ ...prev, [selectedScenarioId]: newSession }));
  };

  const resetSession = () => {
    if (selectedScenarioId) {
      setSessions(prev => {
        const copy = { ...prev };
        delete copy[selectedScenarioId];
        return copy;
      });
      setSelectedAgentIds([]); // 重置选择
      setAutoPlay(false);
    }
  };

  const handleNextTurn = async () => {
    if (!activeSession || isThinking || !meta) return;

    setIsThinking(true);
    
    // 简单的轮流逻辑：根据历史记录最后一个发言者找出下一个
    const chatHistory = activeSession.history.filter(m => m.agentId !== 'context');
    const participants = activeSession.agentIds;
    
    let nextAgentId = participants[0];
    if (chatHistory.length > 0) {
      const lastId = chatHistory[chatHistory.length - 1].agentId;
      const lastIndex = participants.indexOf(lastId);
      // 如果上一个发言者不在当前的参与者列表里（极其罕见），默认切回第一个
      const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % participants.length;
      nextAgentId = participants[nextIndex];
    }

    const newMessageId = Date.now().toString();

    // 1. UI 占位
    setSessions(prev => ({
      ...prev,
      [activeSession.scenarioId]: {
        ...activeSession,
        history: [...activeSession.history, { id: newMessageId, agentId: nextAgentId, content: '', thought: 'Thinking...' }]
      }
    }));

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: activeSession.scenarioId,
          nextAgentId: nextAgentId,
          participants: participants,  // 关键：传当前参与者所有ID
          history: activeSession.history
            .filter(h => h.agentId !== 'context')
            .map(h => ({ agentId: h.agentId, content: h.content }))
        }),
      });

      if (!response.body) throw new Error('No Data');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        streamContent += decoder.decode(value, { stream: true });
        
        setSessions(prev => {
           const curr = prev[activeSession.scenarioId];
           if (!curr) return prev;
           return {
             ...prev,
             [activeSession.scenarioId]: {
               ...curr,
               history: curr.history.map(m => m.id === newMessageId ? { ...m, content: streamContent, thought: undefined } : m)
             }
           };
        });
      }

    } catch (e) {
      console.error(e);
      setAutoPlay(false);
    } finally {
      setIsThinking(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col overflow-hidden">
      
      {/* Header */}
      <header className="flex-none h-14 border-b border-zinc-900 bg-[#0a0a0a] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 -ml-2 text-zinc-400">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-zinc-100">
            <div className="w-6 h-6 bg-zinc-100 rounded flex items-center justify-center text-black font-bold text-xs">S</div>
            <span className="font-bold text-sm tracking-tight">OpenSociety</span>
          </div>
        </div>
        {activeSession && (
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse"/>
            Simulation Active
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* --- Sidebar (Scenarios) --- */}
        <aside className={cn(
          "bg-[#0f0f0f] border-r border-zinc-900 absolute inset-y-0 left-0 z-10 w-64 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3 h-3" /> Environments
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {meta && Object.entries(meta.scenarios).map(([id, config]) => (
              <button
                key={id}
                onClick={() => {
                   setSelectedScenarioId(id);
                   setAutoPlay(false);
                   if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg text-sm transition-all border",
                  selectedScenarioId === id
                    ? "bg-zinc-800 border-zinc-700 text-white"
                    : "border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                )}
              >
                <div className="font-medium">{config.name}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* --- Main Area --- */}
        <main className="flex-1 flex flex-col bg-[#050505] min-w-0 relative">
          
          {/* Loading State */}
          {!meta && (
            <div className="flex-1 flex items-center justify-center text-zinc-600">
              Loading MetaData...
            </div>
          )}

          {/* Configuration View (No Active Session) */}
          {meta && selectedScenarioId && !activeSession && (
            <div className="flex-1 overflow-y-auto p-8 animate-in fade-in zoom-in-95 duration-300">
              <div className="max-w-2xl mx-auto space-y-8">
                
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl mx-auto flex items-center justify-center text-zinc-700 mb-4">
                    <Layers className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
                    {activeScenarioConfig?.name}
                  </h2>
                  <p className="text-zinc-400 leading-relaxed font-light">
                    {activeScenarioConfig?.description}
                  </p>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                       <Users className="w-4 h-4" /> Select Agents
                    </h3>
                    <span className="text-xs text-zinc-500 px-2 py-1 bg-zinc-900 rounded border border-zinc-800">
                      {selectedAgentIds.length} Selected
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(meta.agents).map(([id, agent]) => {
                      const isSelected = selectedAgentIds.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleAgentSelection(id)}
                          className={cn(
                            "relative p-4 rounded-xl text-left transition-all border group",
                            isSelected 
                              ? "bg-zinc-800 border-zinc-600 shadow-lg" 
                              : "bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                               <div className="font-bold text-sm text-zinc-200">{agent.name}</div>
                               <div className="text-[10px] text-zinc-500 uppercase mt-0.5">{agent.role}</div>
                            </div>
                            <div className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center",
                              isSelected ? "bg-white border-white text-black" : "border-zinc-600 group-hover:border-zinc-500"
                            )}>
                              {isSelected && <CheckCircle2 className="w-3 h-3"/>}
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-zinc-500 line-clamp-2 leading-relaxed opacity-80">
                            {agent.personality}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={startSession}
                      disabled={selectedAgentIds.length < 2}
                      className={cn(
                        "px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2",
                        selectedAgentIds.length >= 2
                          ? "bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      )}
                    >
                      Initialize Simulation <ChevronRight className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Chat View (Active Session) */}
          {activeSession && meta && (
             <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-8">
                  {activeSession.history.map((msg) => {
                    const isContext = msg.agentId === 'context';
                    let agentDisplay = { name: 'System', role: 'Context', style: { color: '', icon: <Terminal/> } };
                    
                    if (!isContext) {
                      const agent = meta.agents[msg.agentId];
                      if (agent) {
                        agentDisplay = { 
                          name: agent.name, 
                          role: agent.role, 
                          style: STYLE_MAP[agent.style] || STYLE_MAP.default 
                        };
                      }
                    }

                    return (
                      <div key={msg.id} className={cn(
                        "flex gap-4 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2",
                        isContext ? "justify-center" : ""
                      )}>
                        {!isContext && (
                          <div className="flex-shrink-0 mt-1">
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border", agentDisplay.style.color)}>
                              {agentDisplay.style.icon}
                            </div>
                          </div>
                        )}
                        <div className={cn("flex flex-col gap-2 min-w-0 flex-1", isContext ? "max-w-xl text-center" : "max-w-[85%]")}>
                           {!isContext && (
                             <div className="flex items-baseline gap-2">
                               <span className="font-bold text-zinc-300 text-sm">{agentDisplay.name}</span>
                               <span className="text-[10px] font-mono text-zinc-500 uppercase">{agentDisplay.role}</span>
                             </div>
                           )}
                           <div className={cn(
                             "p-4 rounded-2xl text-sm leading-7 whitespace-pre-wrap shadow-sm",
                             isContext 
                               ? "bg-zinc-900/50 border border-zinc-800 text-zinc-500 font-mono text-xs" 
                               : "bg-[#111] border border-zinc-800/80 text-zinc-300"
                           )}>
                             {msg.thought && (
                               <div className="flex items-center gap-2 text-zinc-600 mb-2 text-xs italic">
                                 <Brain className="w-3 h-3"/> {msg.thought}
                               </div>
                             )}
                             {msg.content}
                             {msg.content === '' && !msg.thought && <span className="inline-block w-2 h-4 bg-zinc-600 animate-pulse"/>}
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Controls */}
                <div className="flex-none p-4 border-t border-zinc-900 bg-[#0a0a0a] z-10 flex justify-center">
                  <div className="flex items-center gap-2 bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800 shadow-xl">
                     <button onClick={resetSession} className="p-3 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="End Simulation">
                       <RefreshCcw className="w-5 h-5" />
                     </button>
                     <div className="w-px h-8 bg-zinc-800 mx-1"/>
                     <button 
                       onClick={handleNextTurn}
                       disabled={isThinking || autoPlay}
                       className={cn(
                         "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
                         isThinking ? "bg-zinc-800 text-zinc-500" : "bg-white text-black hover:bg-zinc-200"
                       )}
                     >
                       {isThinking ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <MessageSquare className="w-4 h-4"/>}
                       Next Turn
                     </button>
                     <button 
                       onClick={() => setAutoPlay(!autoPlay)}
                       className={cn(
                         "p-3 rounded-xl transition-all",
                         autoPlay ? "bg-red-500/20 text-red-500" : "hover:bg-zinc-800 text-zinc-500 hover:text-white"
                       )}
                     >
                       {autoPlay ? <Square className="w-5 h-5 fill-current"/> : <Play className="w-5 h-5 fill-current"/>}
                     </button>
                  </div>
                </div>
             </>
          )}

        </main>
      </div>
    </div>
  );
}
