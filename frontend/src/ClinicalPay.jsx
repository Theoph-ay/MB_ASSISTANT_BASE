import React from 'react';
import { Checkout, CheckoutButton, CheckoutStatus } from '@coinbase/onchainkit/checkout';

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

export default function ClinicalPay({ onSuccess }) {
  const handleStatusChange = (status) => {
    if (status.statusName === 'success') {
      onSuccess();
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-body">
      {/* Left Branding Panel */}
      <section className="hidden lg:flex lg:w-1/2 relative bg-surface-container-lowest items-center justify-center overflow-hidden p-16">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-primary-container blur-[120px]" />
          <div className="absolute right-40 bottom-20 w-64 h-64 rounded-full bg-secondary-container blur-[100px]" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <img src="/avatar.png" alt="NEXUS AI Avatar" className="w-12 h-12 rounded-full shadow-[0_0_15px_rgba(74,142,255,0.3)]" />
            <h1 className="font-headline font-extrabold text-2xl tracking-tight text-primary">NEXUS AI</h1>
          </div>
          <h2 className="font-headline text-5xl font-extrabold text-on-surface leading-tight max-w-lg">
            Precision AI for the <span className="text-primary">Next Generation</span> of Medicine.
          </h2>
          <p className="mt-8 text-on-surface-variant text-lg leading-relaxed max-w-lg">
            A one-time 2 USDC access fee on the Base network unlocks unlimited clinical consultations, diagnostic AI assistance, and curated medical resources.
          </p>
          <div className="flex gap-8 mt-16">
            <div className="flex flex-col">
              <span className="font-headline text-3xl font-bold text-primary">MBBS</span>
              <span className="text-xs font-bold uppercase tracking-widest text-outline">2027 Cohort</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-3xl font-bold text-primary">2 USDC</span>
              <span className="text-xs font-bold uppercase tracking-widest text-outline">One-time Fee</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-3xl font-bold text-primary">24/7</span>
              <span className="text-xs font-bold uppercase tracking-widest text-outline">Clinical Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Payment Panel */}
      <section className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-24 bg-surface">
        <div className="lg:hidden mb-12 flex items-center gap-3">
          <img src="/avatar.png" alt="NEXUS AI" className="w-10 h-10 rounded-full" />
          <span className="font-headline font-extrabold text-xl tracking-tight text-primary">NEXUS AI</span>
        </div>

        <div className="w-full max-w-md">
          <header className="mb-10 text-center lg:text-left">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Clinical Access Required</span>
            <h3 className="font-headline text-3xl font-bold text-on-surface">Unlock the Clinical Engine</h3>
            <p className="text-on-surface-variant mt-2">
              A one-time payment of <span className="text-primary font-bold">2 USDC</span> on the Base network grants permanent access.
            </p>
          </header>

          {/* Payment Widget */}
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg surgical-gradient flex items-center justify-center">
                <Icon name="lock_open" className="text-on-primary" />
              </div>
              <div>
                <h4 className="font-bold text-on-surface">Clinical Access Pass</h4>
                <p className="text-sm text-on-surface-variant">Lifetime unlock • Base Network</p>
              </div>
            </div>

            <Checkout
              productId={import.meta.env.VITE_PUBLIC_CDP_PROJECT_ID}
              onStatus={handleStatusChange}
            >
              <CheckoutButton
                coinbaseEarnRatio={0}
                className="w-full surgical-gradient text-on-primary font-headline font-bold py-4 rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
              />
              <CheckoutStatus className="text-on-surface-variant mt-4 text-center text-[12px] font-medium" />
            </Checkout>
          </div>

          {/* Dev bypass */}
          {import.meta.env.DEV && (
            <button
              onClick={onSuccess}
              className="mt-6 w-full text-center text-[11px] text-primary/30 hover:text-primary underline transition-colors font-label"
            >
              Skip Payment (Developer Bypass)
            </button>
          )}

          <div className="mt-10 pt-8 border-t border-outline-variant/20 text-center">
            <p className="text-on-surface-variant text-sm">
              Payment is processed securely on-chain via the <span className="text-primary font-semibold">Base Network</span>.
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
