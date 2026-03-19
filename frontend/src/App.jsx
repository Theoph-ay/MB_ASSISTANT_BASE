import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, Send, Plus, MessageSquare, Download, Share2, Bot, Paperclip } from 'lucide-react';
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity } from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
import ClinicalPay from './ClinicalPay';

// Logic First: This component manages the Chat State and the Streaming Connection.
// It uses a fetch ReadableStream to update the UI in real-time.

export default function App() {
  const { address, isConnected } = useAccount();
  const [hasPaid, setHasPaid] = useState(false);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome, Colleague. How can I assist with your clinical cases or ENT revision today?' }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Logic: We generate a unique Thread ID for the session to keep track of history
  const threadId = useRef(crypto.randomUUID()); 

  useEffect(() => {
    if (address) {
      const paidStatus = localStorage.getItem(`mb_assistant_paid_${address}`);
      if (paidStatus === 'true') {
        setHasPaid(true);
      } else {
        setHasPaid(false);
      }
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
      // Logic: Connect to your FastAPI endpoint (v1/chat/chat)
      const response = await fetch("http://localhost:8000/api/v1/chat/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-wallet-address": address || "anonymous"
        },
        body: JSON.stringify({ message: input, thread_id: threadId.current }),
      });

      if (!response.ok) throw new Error("Backend Connection Failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";

      // Add a placeholder for the AI response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        aiResponse += chunk;
        
        // Logic: Update only the last message in the array (the AI's current stream)
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = aiResponse;
          return updated;
        });
      }
    } catch (error) {
      console.error("Streaming Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Could not reach the Clinical Engine. Ensure Uvicorn is running and you have paid." }]);
    } finally {
      setIsStreaming(false);
    }
  };

  // Not Connected: Show Login Screen
  if (!isConnected) {
    return (
      <div className="flex h-screen w-full bg-[#121416] text-[#e2e2e5] font-sans items-center justify-center p-6 selection:bg-[#29487f]">
        <div className="max-w-md w-full bg-[#1a1c1e] border border-[#333537] rounded-2xl shadow-2xl overflow-hidden glass-effect flex flex-col items-center justify-center p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#adc7ff] to-[#4a8eff] flex items-center justify-center text-[#001a41] shadow-lg mb-6">
            <Stethoscope size={40} />
          </div>
          <h1 className="font-bold text-3xl mb-2 text-white">MB_ASSISTANT</h1>
          <p className="text-[#c1c6d7] text-sm mb-10">Clinical Engine for Medical Students</p>
          
          <Wallet>
            <ConnectWallet className="bg-gradient-to-br from-[#adc7ff] to-[#4a8eff] text-[#001a41] hover:opacity-90 font-bold py-3 px-8 rounded-xl transition-all shadow-md w-full flex justify-center text-lg">
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
        </div>
      </div>
    );
  }

  // Connected but not paid: Show Gate
  if (isConnected && !hasPaid) {
    return <ClinicalPay onSuccess={handlePaymentSuccess} />;
  }

  // Connected and paid: Show Chat
  return (
    <div className="flex h-screen w-full bg-[#121416] text-[#e2e2e5] font-sans selection:bg-[#29487f]">
      
      {/* Sidebar - Inspired by Stitch's Design */}
      <aside className="w-[280px] h-full flex flex-col bg-[#1a1c1e] border-r border-[#333537] p-6 gap-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#adc7ff] to-[#4a8eff] flex items-center justify-center text-[#001a41] shadow-lg">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">MB_ASSISTANT</h1>
            <p className="text-[#c1c6d7] text-[10px] uppercase font-bold tracking-widest">Clinical Engine</p>
          </div>
        </div>

        <button className="w-full h-11 bg-gradient-to-br from-[#adc7ff] to-[#4a8eff] text-[#001a41] font-bold rounded flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md">
          <Plus size={20} /> New Consultation
        </button>

        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          <p className="text-[#c1c6d7] text-[10px] uppercase font-bold mb-4">Modules</p>
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[#333537] text-[#adc7ff] rounded-lg cursor-pointer">
            <MessageSquare size={18} /> Consultations
          </div>
        </nav>

        {/* User Identity Area */}
        <div className="mt-auto pt-4 border-t border-[#333537]">
          <Wallet>
            <ConnectWallet className="bg-transparent text-[#e2e2e5] hover:bg-[#333537] w-full justify-start rounded-lg px-2 py-2 border-none">
              <Avatar className="h-8 w-8" />
              <Name className="text-sm font-bold text-white ml-2" />
            </ConnectWallet>
            <WalletDropdown className="border border-[#414754] bg-[#1a1c1e]">
              <Identity className="px-4 pt-3 pb-2 hover:bg-[#333537]" hasCopyAddressOnClick>
                <Avatar />
                <Name className="text-white" />
                <Address className="text-[#c1c6d7]" />
              </Identity>
              <WalletDropdownDisconnect className="hover:bg-[#333537] text-red-400" />
            </WalletDropdown>
          </Wallet>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-[#121416]/80 backdrop-blur-md border-b border-[#333537] sticky top-0 z-10">
          <h2 className="font-bold text-lg">Case Review</h2>
          <div className="flex gap-4">
            <Download size={20} className="text-[#c1c6d7] cursor-pointer hover:text-white" />
            <Share2 size={20} className="text-[#c1c6d7] cursor-pointer hover:text-white" />
          </div>
        </header>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-32 custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-4xl mx-auto w-full`}>
              <div className="flex items-center gap-2 mb-2">
                {msg.role === 'assistant' && <Bot size={16} className="text-[#adc7ff]" />}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-[#c1c6d7]' : 'text-[#adc7ff]'}`}>
                  {msg.role === 'user' ? 'Student' : 'MB_ASSISTANT'}
                </span>
              </div>
              <div className={`p-5 rounded-xl max-w-[85%] shadow-lg text-[15px] leading-relaxed ${msg.role === 'user' ? 'bg-[#333537] rounded-tr-none' : 'bg-[#29487f] rounded-tl-none'}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#121416] to-transparent">
          <div className="max-w-4xl mx-auto flex items-end gap-2 p-3 bg-[#1e2022] rounded-xl border border-[#414754] shadow-2xl focus-within:border-[#adc7ff]/50 transition-all">
            <button className="p-2.5 text-[#c1c6d7] hover:text-white"><Paperclip size={20} /></button>
            <textarea 
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] p-2.5 resize-none text-white placeholder-[#c1c6d7]/50"
              placeholder="Ask a clinical question or describe symptoms..."
              rows="1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            />
            <button 
              onClick={handleSend}
              disabled={isStreaming}
              className="w-10 h-10 rounded bg-[#adc7ff] text-[#001a41] flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}