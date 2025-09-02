import { useState } from 'react';
import MobileLayout from '../components/Layout/MobileLayout';
import WalletDetails from '../components/WalletDetails';
import SweepXEC from '../components/SweepXEC';
import SignVerifyMsg from '../components/SignVerifyMsg';
import WalletHealth from '../components/WalletHealth';
import { useAtom } from 'jotai';
import { walletConnectedAtom } from '../atoms';
import '../styles/tools.css';

const ToolsPage = () => {
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [walletConnected] = useAtom(walletConnectedAtom);

  return (
    <MobileLayout title="Tools">
      <div className="tools-content">
        {/* 1. Wallet Details - Collapsible */}
        {walletConnected && (
          <div className="tool-section">
            <div className="section-header">
              <h2>Wallet Details</h2>
              <button
                onClick={() => setShowWalletDetails(!showWalletDetails)}
                className="toggle-button"
                aria-label={showWalletDetails ? 'Hide wallet details' : 'Show wallet details'}
              >
                {showWalletDetails ? '−' : '+'}
              </button>
            </div>
            {showWalletDetails && (
              <div className="section-content">
                <WalletDetails />
              </div>
            )}
          </div>
        )}

        {/* 2. Sweep Paper Wallet - Always Open */}
        {walletConnected && (
          <div className="tool-section">
            <div className="section-header">
              <h2>Sweep Paper Wallet</h2>
            </div>
            <div className="section-content">
              <SweepXEC />
            </div>
          </div>
        )}

        {/* 3. Sign & Verify Messages - Always Open */}
        {walletConnected && (
          <div className="tool-section">
            <div className="section-header">
              <h2>Sign & Verify Messages</h2>
            </div>
            <div className="section-content">
              <SignVerifyMsg />
            </div>
          </div>
        )}

        {/* 4. Wallet Health & Analytics - Always Open */}
        {walletConnected && (
          <div className="tool-section">
            <div className="section-header">
              <h2>Wallet Health & Analytics</h2>
            </div>
            <div className="section-content">
              <WalletHealth />
            </div>
          </div>
        )}

        {/* Show connection prompt if wallet is not connected */}
        {!walletConnected && (
          <div className="tool-section">
            <div className="section-header">
              <h2>Wallet Required</h2>
            </div>
            <div className="section-content">
              <p>Please connect your wallet to access tools and settings.</p>
              <p>Return to the Home page to connect your wallet with your mnemonic phrase.</p>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default ToolsPage;