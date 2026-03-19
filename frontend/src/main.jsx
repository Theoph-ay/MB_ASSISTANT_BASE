import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@coinbase/onchainkit/styles.css';
import './index.css'
import App from './App.jsx'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { coinbaseWallet } from 'wagmi/connectors'

const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'NEXUS AI',
    }),
  ],
  transports: {
    [base.id]: http(),
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider apiKey={import.meta.env.VITE_PUBLIC_ONCHAINKIT_API_KEY} chain={base}>
          <App />
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
