import React, { useState, useRef, useEffect } from 'react';
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity } from '@coinbase/onchainkit/identity';
import { useAccount, useDisconnect } from 'wagmi';
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

/* ── Profile Panel ── */
function ProfilePanel({ onClose, sessions, address }) {
  const { disconnect } = useDisconnect();
  const firstSession = sessions.length > 0
    ? new Date(sessions[sessions.length - 1].updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Today';

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative ml-auto w-[340px] h-full bg-surface-container-low border-l border-surface-variant/30 shadow-2xl shadow-black/40 flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-variant/30">
          <h2 className="font-headline font-bold text-lg text-on-surface">Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
            <Icon name="close" size="text-[20px]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Wallet Identity */}
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="w-20 h-20 rounded-full surgical-gradient flex items-center justify-center shadow-lg shadow-primary/20">
              <Icon name="account_circle" size="text-5xl" className="text-on-primary-container" />
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface text-lg">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'}
              </p>
              <p className="text-on-surface-variant text-xs font-medium mt-1">Base Network</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-high rounded-lg p-4 text-center">
              <p className="font-headline text-2xl font-bold text-primary">{sessions.length}</p>
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mt-1">Consultations</p>
            </div>
            <div className="bg-surface-container-high rounded-lg p-4 text-center">
              <p className="font-headline text-sm font-bold text-primary leading-tight">{firstSession}</p>
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mt-1">Member Since</p>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
              <Icon name="wallet" size="text-[18px]" className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Wallet Address</p>
                <p className="text-on-surface text-xs font-mono truncate mt-0.5">{address || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
              <Icon name="verified" size="text-[18px]" className="text-primary flex-shrink-0" />
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Status</p>
                <p className="text-on-surface text-xs font-bold mt-0.5">Active • Paid</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-surface-variant/30">
          <button
            onClick={() => { disconnect(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-error/30 text-error font-headline font-bold text-sm hover:bg-error/10 transition-colors"
          >
            <Icon name="logout" size="text-[18px]" /> Disconnect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { address, isConnected } = useAccount();
  const [hasPaid, setHasPaid] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');

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

  // Admin wallet bypass (works in both dev and prod)
  const ADMIN_WALLET = (import.meta.env.VITE_ADMIN_WALLET || '').toLowerCase();

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

  // Check payment status from localStorage + admin bypass
  useEffect(() => {
    if (address) {
      // Admin bypass: auto-pay if wallet matches
      if (ADMIN_WALLET && address.toLowerCase() === ADMIN_WALLET) {
        setHasPaid(true);
        return;
      }
      const paid = localStorage.getItem(`nexus_ai_paid_${address}`);
      setHasPaid(paid === 'true');
    } else {
      setHasPaid(false);
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
    localStorage.setItem(`nexus_ai_paid_${address}`, 'true');
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    // Block sending if not connected or not paid
    if (!isConnected || !hasPaid) return;

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
    
    const newHistory = messages.slice(0, index);
    newHistory.push({ role: 'user', content: editCache });
    setMessages(newHistory);
    setEditingIndex(null);
    setIsStreaming(true);

    try {
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

  // ── Share consultation ──
  const handleShare = async () => {
    if (!canChat) return;
    try {
      const res = await fetch('http://localhost:8000/api/v1/chat/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': address || 'anonymous' },
        body: JSON.stringify({ thread_id: threadId.current }),
      });
      if (res.ok) {
        const data = await res.json();
        const link = `${window.location.origin}/shared/${data.share_id}`;
        setShareLink(link);
        setShowShareModal(true);
      } else {
        showToast('Start a conversation before sharing');
      }
    } catch (e) {
      console.error(e);
      showToast('Could not generate share link');
    }
  };

  // ── Download as PDF ──
  const handleDownloadPDF = () => {
    // Build a clean HTML document for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showToast('Please allow popups to download PDF'); return; }

    const chatHTML = messages.map(m => {
      const role = m.role === 'user' ? 'Student' : 'NEXUS AI';
      const bg = m.role === 'user' ? '#e3f2fd' : '#f5f5f5';
      const align = m.role === 'user' ? 'right' : 'left';
      return `<div style="margin:12px 0;text-align:${align}">
        <div style="display:inline-block;max-width:80%;background:${bg};padding:14px 18px;border-radius:12px;text-align:left">
          <strong style="color:#1a73e8;font-size:12px;text-transform:uppercase;letter-spacing:1px">${role}</strong>
          <div style="margin-top:6px;font-size:14px;line-height:1.7;white-space:pre-wrap">${m.content}</div>
        </div>
      </div>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NEXUS AI Consultation</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
          h1 { font-size: 20px; color: #1a73e8; border-bottom: 2px solid #e8eaed; padding-bottom: 12px; }
          .meta { font-size: 11px; color: #666; margin-bottom: 24px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>NEXUS AI — Clinical Consultation</h1>
        <div class="meta">Exported ${new Date().toLocaleString()} • ${messages.length} messages</div>
        ${chatHTML}
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e8eaed;font-size:10px;color:#999;text-align:center">
          © ${new Date().getFullYear()} Theophilus Olayiwola • NEXUS AI Clinical Engine
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  // Determine which view gate to show
  const canChat = isConnected && hasPaid;

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

      {/* Profile Panel */}
      {showProfile && (
        <ProfilePanel
          onClose={() => setShowProfile(false)}
          sessions={sessions}
          address={address}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'} h-full flex flex-col bg-surface-container-low border-r border-transparent flex-shrink-0 z-20 transition-all duration-300`}>
        <div className="p-6 flex flex-col h-full gap-8 min-w-[280px]">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <img src="/avatar.png" alt="NEXUS AI Avatar" className="w-10 h-10 rounded-full object-cover shadow-[0_4px_12px_rgba(74,142,255,0.2)]" />
            <div className="flex flex-col flex-1">
              <h1 className="text-on-surface font-headline font-bold text-lg leading-tight tracking-tight">NEXUS AI</h1>
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
              disabled={!canChat}
              className="w-full h-11 surgical-gradient text-on-primary-container font-headline font-bold text-sm rounded flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_8px_16px_rgba(74,142,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
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
            {!canChat && (
              <div className="px-3 py-4 text-center text-on-surface-variant text-xs font-medium">
                Connect wallet to see your sessions.
              </div>
            )}
            {canChat && sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map(session => (
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
            {canChat && sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-on-surface-variant text-xs font-medium">
                No consultations yet.
              </div>
            )}
          </nav>

          {/* User Identity - OnchainKit */}
          <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-variant/30">
            {isConnected ? (
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
            ) : (
              <Wallet>
                <ConnectWallet className="flex items-center gap-2 surgical-gradient text-on-primary-container font-headline font-bold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity w-full justify-center">
                  <Icon name="account_balance_wallet" size="text-[18px]" />
                  Connect Wallet
                </ConnectWallet>
              </Wallet>
            )}
            <button
              onClick={() => setShowProfile(true)}
              disabled={!isConnected}
              className="text-on-surface-variant hover:text-on-surface p-2 rounded hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
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
            <h2 className="text-on-surface font-headline font-bold text-lg">NEXUS AI</h2>
            <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label text-[10px] uppercase font-bold tracking-widest">
              {canChat ? 'Active' : 'Connect Wallet'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPDF} disabled={!canChat} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-30" title="Export to PDF">
              <Icon name="download" size="text-[20px]" />
            </button>
            <button onClick={handleShare} disabled={!canChat} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-30" title="Share Consultation">
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
                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <button
                        onClick={() => { setEditingIndex(i); setEditCache(msg.content); }}
                        className="p-1.5 rounded-full bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors shadow-sm"
                        title="Edit Message"
                      >
                        <Icon name="edit" size="text-[16px]" />
                      </button>
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
            ) : (
              /* ── AI Message ── */
              <div key={i} className="flex flex-col items-start gap-1 w-full max-w-4xl mx-auto group">
                <div className="flex items-center gap-2 mb-1">
                  <img src="/avatar.png" alt="NEXUS AI Avatar" className="w-6 h-6 rounded-full object-cover shadow-sm shadow-primary/30" />
                  <span className="text-primary font-headline text-sm font-bold tracking-wide">NEXUS AI</span>
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
                <img src="/avatar.png" alt="NEXUS AI Avatar" className="w-6 h-6 rounded-full object-cover shadow-sm shadow-primary/30" />
                <span className="text-primary font-headline text-sm font-bold tracking-wide">NEXUS AI</span>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-[0.75rem] rounded-tl-[0.25rem] p-6 max-w-[90%] w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[#8b949e] font-label text-xs font-medium">NEXUS AI is analyzing...</span>
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
            {canChat ? (
              /* ── Connected & Paid: Normal Input ── */
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
            ) : (
              /* ── Not Connected: Prompt to connect ── */
              <div className="bg-surface-bright/80 glass-effect rounded-[0.5rem] border border-outline-variant/30 shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-center gap-4 p-4">
                <Icon name="lock" size="text-[20px]" className="text-on-surface-variant" />
                <p className="text-on-surface-variant font-body text-sm">Connect your wallet to start chatting with NEXUS AI</p>
                <Wallet>
                  <ConnectWallet className="surgical-gradient text-on-primary-container font-headline font-bold text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(74,142,255,0.2)] flex items-center gap-2">
                    <Icon name="account_balance_wallet" size="text-[16px]" />
                    Connect
                  </ConnectWallet>
                </Wallet>
              </div>
            )}
              <span className="text-on-surface-variant/70 font-label text-[10px] font-medium tracking-wide flex items-center justify-center gap-1 flex-wrap mt-3">
                <span>NEXUS AI can make mistakes. Always verify critical clinical information.</span>
                <span className="opacity-50 mx-1">•</span>
                <span>&copy; {new Date().getFullYear()} Theophilus Olayiwola</span>
              </span>
          </div>
        </div>
      </main>

      {/* ── Share Modal ── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-2xl shadow-black/50 p-8 w-full max-w-md mx-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-lg text-on-surface">Share Consultation</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
                <Icon name="close" size="text-[20px]" />
              </button>
            </div>
            <p className="text-on-surface-variant text-sm mb-4">Anyone with this link can view this consultation (read-only).</p>
            <div className="flex items-center gap-2 bg-surface-container-high rounded-lg p-3 border border-outline-variant/20">
              <Icon name="link" size="text-[18px]" className="text-primary flex-shrink-0" />
              <input
                readOnly
                value={shareLink}
                className="flex-1 bg-transparent text-on-surface text-sm font-mono truncate focus:outline-none"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(shareLink); showToast('Link copied to clipboard'); }}
                className="px-3 py-1.5 surgical-gradient text-on-primary-container font-headline font-bold text-xs rounded hover:opacity-90 transition-opacity flex items-center gap-1 flex-shrink-0"
              >
                <Icon name="content_copy" size="text-[14px]" /> Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}