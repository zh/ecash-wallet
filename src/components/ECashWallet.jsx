import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAtom } from 'jotai';
import { walletAtom, walletConnectedAtom, balanceAtom, derivationModeAtom, hdPathAtom, savedMnemonicAtom, mnemonicSetterAtom, mnemonicCollapsedAtom } from '../atoms';
import { QRCodeSVG } from 'qrcode.react';
import { validateMnemonic, generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { useConnectWallet, useBalance } from '../hooks';
import SendXEC from './SendXEC';
import HdPathSelector from './HdPathSelector';
import SecurityWarnings from './SecurityWarnings';
import './ecashwallet.css';

const ECashWallet = () => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [balance] = useAtom(balanceAtom);
  const [derivationMode] = useAtom(derivationModeAtom);
  const [hdPath] = useAtom(hdPathAtom);
  const [savedMnemonic] = useAtom(savedMnemonicAtom);
  const [, setSavedMnemonic] = useAtom(mnemonicSetterAtom);
  const [mnemonicCollapsed, setMnemonicCollapsed] = useAtom(mnemonicCollapsedAtom);

  const { importWallet, disconnectWallet, clearWalletData } = useConnectWallet();

  // Use the balance hook to manage balance updates
  useBalance();

  // Get the wallet address from the connected wallet
  const xecAddress = wallet ? wallet.walletInfo?.xecAddress : '';

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editableMnemonic, setEditableMnemonic] = useState('');

  const generateNewMnemonic = () => {
    try {
      const newMnemonic = generateMnemonic(wordlist);
      setEditableMnemonic(newMnemonic);
      setSuccessMessage(''); // Clear any success messages
      setErrorMessage(''); // Clear any error messages
    } catch (error) {
      console.error('Failed to generate mnemonic:', error);
      setSuccessMessage('');
      setErrorMessage('Failed to generate mnemonic. Please try again.');
    }
  };



  const handleConnectFromSaved = async () => {
    try {
      const mnemonicToUse = editableMnemonic || savedMnemonic;
      if (!mnemonicToUse.trim()) {
        setSuccessMessage('');
        setErrorMessage('No mnemonic available to connect.');
        return;
      }

      if (!validateMnemonic(mnemonicToUse.trim(), wordlist)) {
        setSuccessMessage('');
        setErrorMessage('Invalid mnemonic. Please check your input.');
        return;
      }

      setSuccessMessage('');
      setErrorMessage('');
      await importWallet(mnemonicToUse);
      setEditableMnemonic('');
    } catch (error) {
      console.error('Failed to connect from saved mnemonic:', error);
      setSuccessMessage('');
      setErrorMessage(error.message);
    }
  };

  const handleSaveMnemonic = () => {
    if (!editableMnemonic.trim()) {
      setSuccessMessage('');
      setErrorMessage('Mnemonic cannot be empty.');
      return;
    }

    if (!validateMnemonic(editableMnemonic.trim(), wordlist)) {
      setSuccessMessage('');
      setErrorMessage('Invalid mnemonic. Please check your input.');
      return;
    }

    setSavedMnemonic(editableMnemonic.trim());
    setErrorMessage('');
    setSuccessMessage('✅ Mnemonic saved successfully to local storage!');

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  const handleResetMnemonic = () => {
    if (window.confirm('Reset wallet? This deletes all data.')) {
      clearWalletData();
      setEditableMnemonic('');
      setSuccessMessage('');
      setErrorMessage('');
      setMnemonicCollapsed(false);
    }
  };

  const toggleMnemonicCollapsed = () => {
    setMnemonicCollapsed(!mnemonicCollapsed);
  };

  // Initialize editable mnemonic from saved mnemonic when component mounts
  useEffect(() => {
    if (savedMnemonic && !editableMnemonic) {
      setEditableMnemonic(savedMnemonic);
    }
    // Always expand mnemonic section when mnemonic is empty (first access)
    if (!editableMnemonic && !savedMnemonic) {
      setMnemonicCollapsed(false);
    }
  }, [savedMnemonic, editableMnemonic, setMnemonicCollapsed]);

  return (
    <div className="ecash-wallet">
      <div className="wallet-header">
        <h2>eCash Wallet</h2>
        {walletConnected && (
          <div className="connection-status">
            <span className="status-indicator connected"></span>
            Connected ({derivationMode === 'cashtab' ? 'CashTab' : 'Standard'})
          </div>
        )}
      </div>

      {!walletConnected ? (
        <>
          <HdPathSelector />

          <div className="mnemonic-section">
            <div
              className="mnemonic-header"
              onClick={toggleMnemonicCollapsed}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleMnemonicCollapsed();
                }
              }}
              tabIndex={0}
              role="button"
              aria-expanded={!mnemonicCollapsed}
              aria-controls="mnemonic-content"
            >
              <span className={`triangle ${mnemonicCollapsed ? 'collapsed' : 'expanded'}`}>
                ▼
              </span>
              <span className="mnemonic-title">
                Wallet Mnemonic <span className="mnemonic-subtitle">(12 words)</span>
              </span>
            </div>

            {!mnemonicCollapsed && (
              <div id="mnemonic-content" className="mnemonic-content">
                <textarea
                  id="mnemonic-input"
                  value={editableMnemonic}
                  onChange={(e) => setEditableMnemonic(e.target.value)}
                  placeholder={editableMnemonic.trim()
                    ? "Your 12-word mnemonic phrase"
                    : "Your generated mnemonic will appear here"}
                  rows="3"
                  className="mnemonic-input"
                />
                <div className="mnemonic-buttons">
                  {!editableMnemonic.trim() ? (
                    <button onClick={generateNewMnemonic} className="generate-btn">
                      Generate
                    </button>
                  ) : (
                    <>
                      <button onClick={handleConnectFromSaved}>
                        Connect
                      </button>
                      <button onClick={handleSaveMnemonic}>
                        Save
                      </button>
                      <button onClick={handleResetMnemonic}>
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>


          {successMessage && (
            <div className="connection-success">
              <p>{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="connection-error">
              <p>{errorMessage}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="wallet-info">
            <QRCodeSVG value={xecAddress} size={128} className="wallet-qr" />
            <div className="address-info">
              <p><strong>Address:</strong> <span className="address-text">{xecAddress}</span></p>
              <p><strong>HD Path:</strong> <code>{hdPath}</code></p>
            </div>
            <div className="balance-info">
              <p className="balance-main">
                <strong>Balance:</strong> {balance ? balance.toFixed(2) : '0.00'} XEC
              </p>
              {balance > 0 && (
                <p className="balance-sub">
                  ({(balance * 100).toFixed(0)} satoshis)
                </p>
              )}
            </div>
          </div>

          <SecurityWarnings showInline={true} />

          <SendXEC />

          <div className="wallet-actions">
            <button
              className="disconnect-btn"
              onClick={() => {
                disconnectWallet();
                setErrorMessage('');
              }}
            >
              Disconnect Wallet
            </button>
          </div>
        </>
      )}
    </div>
  );
};

ECashWallet.propTypes = {
  onConnect: PropTypes.func,
  onDisconnect: PropTypes.func,
};

export default ECashWallet;

