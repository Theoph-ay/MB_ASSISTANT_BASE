import React from 'react';
import { Checkout, CheckoutButton, CheckoutStatus } from '@coinbase/onchainkit/checkout';
import { Bot, ShieldAlert } from 'lucide-react';

export default function ClinicalPay({ onSuccess }) {
  const handleStatusChange = (status) => {
    // Unlock if successful (checking raw status name from OnchainKit)
    if (status.statusName === 'success') {
      onSuccess();
    }
  };

  return (
    <div className="flex h-full w-full bg-[#121416] text-[#e2e2e5] font-sans items-center justify-center p-6 selection:bg-[#29487f]">
      <div className="max-w-md w-full bg-[#1a1c1e] border border-[#333537] rounded-2xl shadow-2xl overflow-hidden glass-effect">
        
        {/* Header Section */}
        <div className="p-8 pb-6 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#333537] flex items-center justify-center text-[#adc7ff] shadow-inner mb-2">
            <ShieldAlert size={32} />
          </div>
          
          <div className="space-y-2">
            <h1 className="font-bold text-2xl text-white tracking-tight">Clinical Access Required</h1>
            <p className="text-[#c1c6d7] text-[14px] leading-relaxed">
              MB_ASSISTANT is gated. A one-time payment of <span className="text-[#adc7ff] font-bold">2 USDC</span> on the Base network is required to unlock the Clinical Engine.
            </p>
          </div>
        </div>

        {/* Payment Action Section */}
        <div className="p-8 pt-4 bg-[#121416]/80 border-t border-[#333537]">
          <div className="flex justify-center w-full">
            <Checkout 
              productId={import.meta.env.VITE_PUBLIC_CDP_PROJECT_ID}
              onStatus={handleStatusChange}
            >
              <CheckoutButton 
                coinbaseEarnRatio={0} 
                className="w-full bg-gradient-to-br from-[#adc7ff] to-[#4a8eff] text-[#001a41] hover:opacity-90 font-bold py-3 rounded-xl transition-all shadow-md"
              />
              <CheckoutStatus className="text-[#c1c6d7] mt-4 text-center text-[12px] font-medium" />
            </Checkout>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-[#c1c6d7]/60 font-bold uppercase tracking-widest">
            <Bot size={14} />
            <span>Secured by OnchainKit</span>
          </div>

          {/* Dev Bypass Button */}
          {import.meta.env.DEV && (
            <button 
              onClick={onSuccess} 
              className="mt-6 w-full text-center text-[10px] text-[#adc7ff]/30 hover:text-[#adc7ff] underline transition-colors"
            >
              Skip Payment (Developer Bypass)
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
