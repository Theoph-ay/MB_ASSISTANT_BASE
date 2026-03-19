import React, { useState, useRef, useEffect } from 'react';
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity } from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
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
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const threadId = useRef(crypto.randomUUID());

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check payment status from localStorage
  useEffect(() => {
    if (address) {
      const paid = localStorage.getItem(`mb_assistant_paid_${address}`);
      setHasPaid(paid === 'true');
    }
  }, [address]);

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
    }
  };

  const handleNewConsultation = () => {
    threadId.current = crypto.randomUUID();
    setMessages([
      { role: 'assistant', content: 'New consultation started. How can I assist you today?' },
    ]);
  };

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
              <h1 className="font-headline font-extrabold text-3xl tracking-tight text-primary">MB_ASSISTANT</h1>
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
            <span className="font-headline font-bold text-xl tracking-tight text-primary">MB_ASSISTANT</span>
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
    <div className="flex h-screen w-full max-w-[1440px] mx-auto bg-surface-container-low">
      {/* ── Sidebar ── */}
      <aside className="w-[280px] h-full flex flex-col bg-surface-container-low border-r border-transparent flex-shrink-0 z-20">
        <div className="p-6 flex flex-col h-full gap-8">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg surgical-gradient flex items-center justify-center text-on-primary-container flex-shrink-0 shadow-[0_4px_12px_rgba(74,142,255,0.2)]">
              <Icon name="stethoscope" size="text-2xl" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-on-surface font-headline font-bold text-lg leading-tight tracking-tight">MB_ASSISTANT</h1>
              <p className="text-on-surface-variant font-label text-xs uppercase tracking-wider font-bold">Clinical Engine</p>
            </div>
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
            <h2 className="text-on-surface-variant font-label text-[10px] uppercase font-bold tracking-widest mb-2 mt-4 px-2">Active Modules</h2>
            <a className="flex items-center gap-3 px-3 py-2.5 rounded bg-surface-container-high text-primary font-headline font-medium text-sm relative" href="#">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
              <Icon name="chat" fill size="text-[20px]" /> Consultations
            </a>
            <a className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-headline font-medium text-sm transition-colors" href="#">
              <Icon name="library_books" size="text-[20px]" /> Medical Library
            </a>
            <a className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-headline font-medium text-sm transition-colors" href="#">
              <Icon name="vital_signs" size="text-[20px]" /> Patient Cases
            </a>
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
            <h2 className="text-on-surface font-headline font-bold text-lg">Case Review</h2>
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
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth flex flex-col gap-8 pb-32">
          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              /* ── User Message ── */
              <div key={i} className="flex flex-col items-end gap-1 w-full max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-on-surface font-headline text-sm font-medium">Student</span>
                </div>
                <div className="bg-surface-container-highest text-on-surface p-5 rounded-[0.5rem] rounded-tr-[0.25rem] max-w-[85%] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
                  <p className="font-body text-[15px] leading-[1.6] whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : (
              /* ── AI Message ── */
              <div key={i} className="flex flex-col items-start gap-1 w-full max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-on-primary">
                    <Icon name="smart_toy" size="text-[14px]" />
                  </div>
                  <span className="text-primary font-headline text-sm font-bold tracking-wide">MB_ASSISTANT</span>
                </div>
                <div className="bg-secondary-container text-on-surface p-6 rounded-[0.5rem] rounded-tl-[0.25rem] max-w-[90%] shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
                  <p className="font-body text-[15px] leading-[1.6] whitespace-pre-wrap">{msg.content}</p>
                </div>
                {/* Action buttons */}
                {msg.content && (
                  <div className="flex gap-2 mt-2 px-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors font-label text-[11px] font-bold uppercase tracking-wider"
                    >
                      <Icon name="content_copy" size="text-[14px]" /> Copy
                    </button>
                  </div>
                )}
              </div>
            )
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-on-surface-variant font-label text-xs">MB_ASSISTANT is thinking...</span>
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
              <span className="text-on-surface-variant/70 font-label text-[10px] font-medium tracking-wide">MB_ASSISTANT can make mistakes. Always verify critical clinical information.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}