import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Maximize2, 
  Minimize2, 
  RotateCcw,
  ArrowUp,
  MessageSquare
} from 'lucide-react';
import { quickPrompts, getCopilotAnswer } from '../data/copilotKnowledge';

export default function AiCopilotWidget({ inventoryList, kpis }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Halo! Saya **Rexa AI Copilot** (Read-Only Secure Assistant). Saya dapat menganalisis kondisi kas gudang, mendeteksi modal tertahan pada deadstock, serta merekomendasikan tindakan restock secara real-time. Ada yang ingin Anda tanyakan?',
      tag: 'System Ready',
      confidence: 99.8,
      timestamp: 'Baru saja'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    const userMsg = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      const answer = getCopilotAnswer(query, inventoryList, kpis);
      const assistantMsg = {
        sender: 'assistant',
        text: answer.text,
        tag: answer.tag,
        confidence: answer.confidence,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 600);
  };

  const resetChat = () => {
    setMessages([
      {
        sender: 'assistant',
        text: 'Riwayat percakapan telah dibersihkan. Silakan tanyakan informasi lain terkait stok barang atau arus kas bisnis Anda.',
        tag: 'System Ready',
        confidence: 99.8,
        timestamp: 'Baru saja'
      }
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 bg-[#1b4d3e] hover:bg-[#143d31] text-white px-5 py-3.5 rounded-full shadow-[0_8px_30px_rgba(27,77,62,0.3)] border border-[#a2d2bf]/40 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#a2d2bf]" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>

          <div className="text-left leading-tight">
            <div className="font-extrabold text-xs text-white flex items-center gap-1.5">
              <span>Tanya Rexa Copilot</span>
              <span className="text-[9px] bg-emerald-600/80 px-1.5 py-0.2 rounded font-bold text-white">AI</span>
            </div>
            <div className="text-[10px] text-[#a2d2bf] font-medium">Asisten Operasional Kas</div>
          </div>
        </button>
      )}

      {/* Slide-over / Expandable Chatbot Drawer */}
      {isOpen && (
        <div 
          className={`bg-white rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.25)] border border-slate-300 flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-5 ${
            isMinimized ? 'w-80 h-16' : 'w-[92vw] sm:w-[440px] h-[600px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-[#1b4d3e] text-white px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 text-[#a2d2bf] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs text-white">
                    Rexa Operational Copilot
                  </span>
                  <span className="text-[9px] font-bold bg-[#4e8a6e] text-white px-1.5 py-0.2 rounded">
                    Read-Only
                  </span>
                </div>
                <div className="text-[10px] text-[#a2d2bf] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Secure LLM Sandbox &bull; AWS Bedrock</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title={isMinimized ? "Perbesar" : "Perkecil"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={resetChat}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Reset Percakapan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Tutup Widget"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 text-xs select-text">
                {messages.map((msg, index) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div 
                      key={index}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div 
                        className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed ${
                          isUser
                            ? 'bg-[#1b4d3e] text-white rounded-tr-xs shadow-xs'
                            : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200 shadow-xs'
                        }`}
                      >
                        {/* Tag & Confidence */}
                        {!isUser && msg.tag && (
                          <div className="flex items-center justify-between text-[10px] font-bold text-[#1b4d3e] mb-1.5 pb-1 border-b border-slate-100">
                            <span className="uppercase tracking-wider">{msg.tag}</span>
                            {msg.confidence && (
                              <span className="text-slate-400 font-medium">
                                {msg.confidence}% Akurasi
                              </span>
                            )}
                          </div>
                        )}

                        {/* Text rendering */}
                        <div className="whitespace-pre-wrap space-y-1.5">
                          {msg.text.split('\n\n').map((paragraph, pIdx) => (
                            <p key={pIdx}>
                              {paragraph.split('**').map((chunk, cIdx) => 
                                cIdx % 2 === 1 ? (
                                  <strong key={cIdx} className={isUser ? "text-[#a2d2bf] font-extrabold" : "text-[#1b4d3e] font-extrabold"}>
                                    {chunk}
                                  </strong>
                                ) : chunk
                              )}
                            </p>
                          ))}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 px-1 font-medium">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-slate-500 p-2 text-xs bg-white rounded-xl border border-slate-200 w-fit">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#1b4d3e] animate-bounce" />
                    <span className="inline-block w-2 h-2 rounded-full bg-[#1b4d3e] animate-bounce [animation-delay:0.2s]" />
                    <span className="inline-block w-2 h-2 rounded-full bg-[#1b4d3e] animate-bounce [animation-delay:0.4s]" />
                    <span className="text-[11px] text-[#1b4d3e] font-bold ml-1">
                      Rexa sedang menganalisis data inventaris...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Carousel */}
              <div className="p-2.5 bg-white border-t border-slate-200 overflow-x-auto whitespace-nowrap">
                <div className="flex items-center gap-2 px-1">
                  {quickPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(p.query)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-50 hover:bg-[#eaf4ef] text-slate-700 hover:text-[#1b4d3e] border border-slate-200 transition-colors shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-[#1b4d3e]" />
                      <span>{p.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-300 px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#1b4d3e]/30 focus-within:bg-white focus-within:border-[#1b4d3e] transition-all">
                  <input
                    type="text"
                    placeholder="Tanya kueri data inventaris / arus kas..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1 py-1.5 text-xs bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400 font-medium"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputQuery.trim() || isTyping}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      inputQuery.trim() && !isTyping
                        ? 'bg-[#1b4d3e] text-white hover:bg-[#143d31] shadow-xs active:scale-90'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4 font-bold" />
                  </button>
                </div>

                <div className="mt-2 text-center text-[10px] text-slate-400">
                  Rexa Copilot read-only secure: seluruh draf PO wajib disetujui via tombol otorisasi REST API.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
