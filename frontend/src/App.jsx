import React, { useState, useRef, useEffect } from 'react';
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity } from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ClinicalPay from './ClinicalPay';

/* ── Helper: Material Icon shorthand ── */
function Icon({ name, fill = false, size = 'text-[20px]', className = '' }) {
  return (
    <span
      className={`material-symbols-outlined ${size} ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : {}}
    >
      {name}
    </span>
  );
}

export default function App() {
  const { address, isConnected } = useAccount();
  const [hasPaid, setHasPaid] = useState(false);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome, Colleague. How can I assist with your clinical cases or ENT revision today?' }
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editCache, setEditCache] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const threadId = useRef(crypto.randomUUID());
  const menuRef = useRef(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Auto-scroll to bottom on every message update (including each streaming chunk)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Check payment status from localStorage
  useEffect(() => {
    if (address) {
      const paid = localStorage.getItem(`mb_assistant_paid_${address}`);
      setHasPaid(paid === 'true');
    }
  }, [address]);

  const loadSessions = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/chat/sessions', {
        headers: {
          'x-wallet-address': address || 'anonymous',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/chat/history/${id}`, {
        headers: {
          'x-wallet-address': address || 'anonymous',
        }
      });
      if (res.ok) {
        const data = await res.json();
        threadId.current = data.thread_id;
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isConnected && hasPaid && address) {
      loadSessions();
    }
  }, [isConnected, hasPaid, address]);

  const handlePaymentSuccess = () => {
    setHasPaid(true);
    localStorage.setItem(`mb_assistant_paid_${address}`, 'true');
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:8000/api/v1/chat/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address || 'anonymous',
        },
        body: JSON.stringify({ message: input, thread_id: threadId.current }),
      });
      if (!response.ok) throw new Error('Backend Connection Failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponse += decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: aiResponse };
          return updated;
        });
      }
    } catch (error) {
      console.error('Streaming Error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not reach the Clinical Engine. Ensure Uvicorn is running.' },
      ]);
    } finally {
      setIsStreaming(false);
      loadSessions();
    }
  };

  const handleEditSubmit = async (index) => {
    if (!editCache.trim() || isStreaming) {
      setEditingIndex(null);
      return;
    }
    
    // Optimistically truncate local state
    const newHistory = messages.slice(0, index);
    newHistory.push({ role: 'user', content: editCache });
    setMessages(newHistory);
    setEditingIndex(null);
    setIsStreaming(true);

    try {
      // Tell backend to truncate history up to `index` and insert the new message
      // Note: We need to modify backend `/edit` endpoint to allow resubmission, 
      // or we can call `/edit` then `/chat`. For now, let's call `/edit` to truncate,
      // and then call `/chat` normally (assuming backend `/edit` is fixed to just truncate).
      await fetch('http://localhost:8000/api/v1/chat/edit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address || 'anonymous',
        },
        body: JSON.stringify({ 
          thread_id: threadId.current, 
          message_index: index, 
          new_content: editCache 
        }),
      });

      // Now call chat again with the new message
      // Notice we do NOT send the message in the `messages` array, we send it as a fresh `POST /chat`
      // Wait, if the backend `/edit` appends the user message as per current logic, calling POST /chat with the same message appends it TWICE.
      // I will fix the backend `/edit` to ONLY truncate, leaving the user message to be appended by `/chat`. 
      // Actually, if we just send the message to `/chat` now:
      const response = await fetch('http://localhost:8000/api/v1/chat/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address || 'anonymous',
        },
        body: JSON.stringify({ message: editCache, thread_id: threadId.current }),
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponse += decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: aiResponse };
          return updated;
        });
      }
    } catch (error) {
       console.error(error);
    } finally {
       setIsStreaming(false);
       loadSessions();
    }
  };

  const handleNewConsultation = () => {
    threadId.current = crypto.randomUUID();
    setMessages([
      { role: 'assistant', content: 'New consultation started. How can I assist you today?' },
    ]);
  };

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  /* ─────────────────────────────  LOGIN SCREEN  ───────────────────────────── */
  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        {/* Left Branding Panel */}
        <section className="hidden lg:flex lg:w-1/2 relative bg-surface-container-low items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary blur-[120px]" />
            <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-secondary blur-[100px]" />
          </div>
          <div className="relative z-10 px-12 text-center lg:text-left">
            <div className="mb-8 flex items-center gap-3">
              <Icon name="clinical_notes" size="text-4xl" className="text-primary" />
              <h1 className="font-headline font-extrabold text-3xl tracking-tight text-primary">MB Assistant</h1>
            </div>
            <h2 className="font-headline text-5xl font-bold text-on-surface leading-tight mb-6">
              Clinical intelligence <br />
              <span className="text-on-surface-variant font-medium">reimagined for students.</span>
            </h2>
            <p className="text-on-surface-variant text-lg max-w-md leading-relaxed mb-10">
              Access AI-powered clinical case review, ENT revision, and diagnostic assistance — gated by Base network for the MBBS 2027 cohort.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-xl bg-surface-container-high shadow-lg shadow-black/20">
                <Icon name="security" className="text-primary mb-2" />
                <div className="text-on-surface font-semibold">On-Chain Gated</div>
                <div className="text-xs text-on-surface-variant mt-1">Base Network USDC</div>
              </div>
              <div className="p-6 rounded-xl bg-surface-container-high shadow-lg shadow-black/20">
                <Icon name="bolt" className="text-primary mb-2" />
                <div className="text-on-surface font-semibold">Real-time AI</div>
                <div className="text-xs text-on-surface-variant mt-1">Streaming Responses</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Login Panel */}
        <section className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-24 bg-surface">
          <div className="lg:hidden mb-12 flex items-center gap-2">
            <Icon name="clinical_notes" size="text-3xl" className="text-primary" />
            <span className="font-headline font-bold text-xl tracking-tight text-primary">MB Assistant</span>
          </div>
          <div className="w-full max-w-md">
            <header className="mb-10 text-center lg:text-left">
              <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">Connect to the Clinical Suite</h3>
              <p className="text-on-surface-variant font-medium">Connect your Base wallet to access the portal</p>
            </header>

            <Wallet>
              <ConnectWallet className="w-full surgical-gradient text-on-primary font-headline font-bold text-lg rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 h-14">
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>

            <div className="mt-10 pt-8 border-t border-outline-variant/20 text-center">
              <p className="text-on-surface-variant">
                Don't have a wallet?
                <a className="ml-1 font-bold text-primary hover:text-primary-container transition-colors" href="https://www.coinbase.com/wallet" target="_blank" rel="noreferrer">
                  Get Coinbase Wallet
                </a>
              </p>
            </div>
          </div>

          <div className="mt-auto pt-12 flex flex-wrap justify-center gap-6 opacity-40">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Icon name="verified_user" size="text-sm" /> BASE NETWORK
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Icon name="gpp_good" size="text-sm" /> ONCHAINKIT
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Icon name="health_and_safety" size="text-sm" /> CLINICAL GRADE
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ───────────────────────────  PAYMENT GATE  ─────────────────────────────── */
  if (isConnected && !hasPaid) {
    return <ClinicalPay onSuccess={handlePaymentSuccess} />;
  }

  /* ─────────────────────────  MAIN CHAT INTERFACE  ────────────────────────── */
  return (
    <div className="flex h-screen w-full max-w-[1440px] mx-auto bg-surface-container-low relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-3 rounded-full shadow-lg font-headline text-sm font-medium animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
          <Icon name="check_circle" size="text-[18px]" className="text-primary" />
          {toastMessage}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'} h-full flex flex-col bg-surface-container-low border-r border-transparent flex-shrink-0 z-20 transition-all duration-300`}>
        <div className="p-6 flex flex-col h-full gap-8 min-w-[280px]">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg surgical-gradient flex items-center justify-center text-on-primary-container flex-shrink-0 shadow-[0_4px_12px_rgba(74,142,255,0.2)]">
              <Icon name="stethoscope" size="text-2xl" />
            </div>
            <div className="flex flex-col flex-1">
              <h1 className="text-on-surface font-headline font-bold text-lg leading-tight tracking-tight">MB Assistant</h1>
              <p className="text-on-surface-variant font-label text-xs uppercase tracking-wider font-bold">Clinical Engine</p>
            </div>
            <button onClick={toggleSidebar} className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors" title="Collapse sidebar">
              <Icon name="menu_open" size="text-[20px]" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <button
              onClick={handleNewConsultation}
              className="w-full h-11 surgical-gradient text-on-primary-container font-headline font-bold text-sm rounded flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_8px_16px_rgba(74,142,255,0.15)]"
            >
              <Icon name="add" size="text-[20px]" /> New Consultation
            </button>
            <div className="relative group">
              <Icon name="search" size="text-[20px]" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                className="w-full h-10 bg-surface-container-high border-none rounded text-sm text-on-surface placeholder-on-surface-variant focus:ring-1 focus:ring-outline-variant focus:bg-surface-container-highest transition-colors pl-10 pr-4"
                placeholder="Search histories..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            <h2 className="text-on-surface-variant font-label text-[10px] uppercase font-bold tracking-widest mb-2 mt-4 px-2">Recent Consultations</h2>
            {sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map(session => (
              <div key={session.thread_id} className="relative group/session">
                {/* Rename inline input */}
                {renameId === session.thread_id ? (
                  <div className="flex items-center gap-1 px-3 py-1.5">
                    <input
                      autoFocus
                      className="flex-1 bg-surface-container-high text-on-surface text-sm rounded px-2 py-1.5 border border-primary focus:ring-1 focus:ring-primary outline-none"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          await fetch('http://localhost:8000/api/v1/chat/rename', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', 'x-wallet-address': address || 'anonymous' },
                            body: JSON.stringify({ thread_id: session.thread_id, new_title: renameValue }),
                          });
                          setRenameId(null);
                          loadSessions();
                          showToast('Session renamed');
                        }
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                    />
                    <button onClick={() => setRenameId(null)} className="p-1 text-on-surface-variant hover:text-on-surface">
                      <Icon name="close" size="text-[16px]" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => loadHistory(session.thread_id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-high font-headline font-medium text-sm transition-colors text-left relative ${
                      threadId.current === session.thread_id ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {threadId.current === session.thread_id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                    )}
                    <Icon name="chat" fill={threadId.current === session.thread_id} size="text-[20px]" className="flex-shrink-0" />
                    <span className="truncate flex-1">{session.title}</span>
                    {/* 3-dot menu trigger */}
                    <span
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.thread_id ? null : session.thread_id); }}
                      className="opacity-0 group-hover/session:opacity-100 p-0.5 rounded hover:bg-surface-container-highest transition-opacity flex-shrink-0 cursor-pointer"
                    >
                      <Icon name="more_vert" size="text-[18px]" />
                    </span>
                  </button>
                )}
                {/* Dropdown menu */}
                {menuOpenId === session.thread_id && (
                  <div ref={menuRef} className="absolute right-2 top-full mt-1 z-50 bg-surface-container-high border border-outline-variant/30 rounded-lg shadow-xl shadow-black/40 py-1 w-40">
                    <button
                      onClick={() => { setRenameId(session.thread_id); setRenameValue(session.title); setMenuOpenId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      <Icon name="edit" size="text-[16px]" /> Rename
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`http://localhost:8000/api/v1/chat/delete/${session.thread_id}`, {
                          method: 'DELETE',
                          headers: { 'x-wallet-address': address || 'anonymous' },
                        });
                        setMenuOpenId(null);
                        // If we deleted the active session, start fresh
                        if (threadId.current === session.thread_id) handleNewConsultation();
                        loadSessions();
                        showToast('Session deleted');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-surface-container-highest transition-colors"
                    >
                      <Icon name="delete" size="text-[16px]" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-on-surface-variant text-xs font-medium">
                No consultations yet.
              </div>
            )}
          </nav>

          {/* User Identity - OnchainKit */}
          <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-variant/30">
            <Wallet>
              <ConnectWallet className="flex items-center gap-3 hover:bg-surface-container-high p-2 -ml-2 rounded cursor-pointer transition-colors flex-1 bg-transparent border-none text-on-surface">
                <Avatar className="w-8 h-8 rounded flex-shrink-0" />
                <div className="flex flex-col truncate">
                  <Name className="text-on-surface font-headline font-bold text-sm leading-tight truncate" />
                </div>
              </ConnectWallet>
              <WalletDropdown className="border border-outline-variant bg-surface-container-low">
                <Identity className="px-4 pt-3 pb-2 hover:bg-surface-container-high" hasCopyAddressOnClick>
                  <Avatar />
                  <Name className="text-on-surface" />
                  <Address className="text-on-surface-variant" />
                </Identity>
                <WalletDropdownDisconnect className="hover:bg-surface-container-high text-error" />
              </WalletDropdown>
            </Wallet>
            <button className="text-on-surface-variant hover:text-on-surface p-2 rounded hover:bg-surface-container-high transition-colors">
              <Icon name="settings" size="text-[20px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <main className="flex-1 flex flex-col bg-surface relative min-w-0">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-8 bg-surface/90 glass-effect border-b border-surface-variant/30 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={toggleSidebar} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors mr-1" title="Open sidebar">
                <Icon name="menu" size="text-[20px]" />
              </button>
            )}
            <h2 className="text-on-surface font-headline font-bold text-lg">MB Assistant</h2>
            <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label text-[10px] uppercase font-bold tracking-widest">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors" title="Export to PDF">
              <Icon name="download" size="text-[20px]" />
            </button>
            <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors" title="Share Consultation">
              <Icon name="share" size="text-[20px]" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col gap-6 pb-32">
          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              /* ── User Message ── */
              <div key={i} className="flex flex-col items-end gap-1 w-full max-w-4xl mx-auto group">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-on-surface font-headline text-sm font-medium">Student</span>
                </div>
                <div className="relative bg-[#21262d] text-[#e6edf3] p-5 rounded-[0.75rem] rounded-tr-[0.25rem] max-w-[85%] border border-[#30363d] shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                  {editingIndex === i ? (
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <textarea
                        className="w-full bg-[#161b22] text-[#e6edf3] p-2 rounded text-[15px] custom-scrollbar resize-none border border-[#30363d] focus:ring-1 focus:ring-primary outline-none"
                        value={editCache}
                        onChange={(e) => setEditCache(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingIndex(null)} className="px-3 py-1 text-xs text-[#8b949e] hover:text-[#e6edf3] focus:outline-none">Cancel</button>
                        <button onClick={() => handleEditSubmit(i)} className="px-3 py-1 bg-primary text-on-primary rounded text-xs font-bold shadow focus:outline-none">Update & Send</button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-[15px] leading-[1.6] whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {/* Action buttons (Hover) */}
                  {!editingIndex && (
                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => { setEditingIndex(i); setEditCache(msg.content); }}
                        className="p-1.5 rounded-full bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors shadow-sm"
                        title="Edit Message"
                      >
                        <Icon name="edit" size="text-[16px]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── AI Message ── */
              <div key={i} className="flex flex-col items-start gap-1 w-full max-w-4xl mx-auto group">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded surgical-gradient flex items-center justify-center text-on-primary">
                    <Icon name="stethoscope" size="text-[14px]" />
                  </div>
                  <span className="text-primary font-headline text-sm font-bold tracking-wide">MB Assistant</span>
                </div>
                <div className="relative bg-[#161b22] text-[#e6edf3] p-6 rounded-[0.75rem] rounded-tl-[0.25rem] max-w-[90%] border border-[#30363d] shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                  <div className="font-body text-[15px] leading-[1.7] prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-headings:font-headline prose-headings:text-[#e6edf3] prose-a:text-primary hover:prose-a:text-primary-container prose-strong:text-[#e6edf3] prose-ul:my-2 prose-li:my-0.5 prose-th:text-[#e6edf3] prose-td:border-[#30363d] prose-th:border-[#30363d] prose-table:border-[#30363d]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                  {/* Action buttons (Hover) */}
                  {msg.content && (
                    <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.content); showToast('Message copied to clipboard'); }}
                        className="p-1.5 rounded-full bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors shadow-sm"
                        title="Copy text"
                      >
                        <Icon name="content_copy" size="text-[16px]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          ))}
          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex flex-col items-start gap-1 w-full max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded surgical-gradient flex items-center justify-center text-on-primary">
                  <Icon name="stethoscope" size="text-[14px]" />
                </div>
                <span className="text-primary font-headline text-sm font-bold tracking-wide">MB Assistant</span>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-[0.75rem] rounded-tl-[0.25rem] p-6 max-w-[90%] w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[#8b949e] font-label text-xs font-medium">MB Assistant is analyzing...</span>
                </div>
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 bg-[#30363d] rounded-full w-[85%]" />
                  <div className="h-3 bg-[#30363d] rounded-full w-[70%]" />
                  <div className="h-3 bg-[#30363d] rounded-full w-[60%]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface/90 to-transparent pt-10 pb-6 px-8 pointer-events-none">
          <div className="max-w-4xl mx-auto w-full pointer-events-auto">
            <div className="bg-surface-bright/80 glass-effect rounded-[0.5rem] border border-outline-variant/30 shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-end gap-2 p-3 transition-all focus-within:border-primary/50 focus-within:bg-surface-bright">
              <button className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors flex-shrink-0 mb-0.5" title="Attach Medical File">
                <Icon name="attach_file" size="text-[20px]" />
              </button>
              <textarea
                className="flex-1 max-h-32 bg-transparent border-none text-on-surface placeholder-on-surface-variant font-body text-[15px] resize-none focus:ring-0 p-2.5 custom-scrollbar leading-relaxed"
                placeholder="Ask a clinical question, analyze data, or type a symptom..."
                rows="1"
                style={{ minHeight: '44px' }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              />
              <button
                onClick={handleSend}
                disabled={isStreaming}
                className="w-10 h-10 rounded surgical-gradient text-on-primary-container flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity mb-0.5 shadow-[0_4px_12px_rgba(74,142,255,0.2)] disabled:opacity-50"
              >
                <Icon name="send" fill size="text-[20px]" />
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-on-surface-variant/70 font-label text-[10px] font-medium tracking-wide">MB Assistant can make mistakes. Always verify critical clinical information.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}