import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAtom, useSetAtom } from 'jotai';
import { busyAtom, notificationAtom, mnemonicAtom, walletConnectedAtom } from '../atoms';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { sanitizeInput, isValidMnemonicFormat } from '../utils/validation';
import '../styles/mnemonic.css';

const Mnemonic = ({ showSave = true, showGenerate = true }) => {
  const [mnemonic, setMnemonic] = useAtom(mnemonicAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const setNotification = useSetAtom(notificationAtom);
  const [busy] = useAtom(busyAtom);

  // Load mnemonic from localStorage on component mount (XEC-specific key)
  useEffect(() => {
    const savedMnemonic = localStorage.getItem('ecash-mnemonic');
    if (savedMnemonic) {
      setMnemonic(savedMnemonic);
    }
  }, [setMnemonic]);

  const handleGenerate = () => {
    const newMnemonic = generateMnemonic(wordlist);
    setMnemonic(newMnemonic);
    setNotification({ type: 'success', message: 'New mnemonic generated.' });
  };

  const handleSave = () => {
    try {
      const sanitized = sanitizeInput(mnemonic, 'mnemonic');

      if (!sanitized) {
        setNotification({ type: 'error', message: 'Mnemonic cannot be empty.' });
        return;
      }

      if (!isValidMnemonicFormat(sanitized)) {
        setNotification({ type: 'error', message: 'Invalid mnemonic format.' });
        return;
      }

      if (!validateMnemonic(sanitized, wordlist)) {
        setNotification({ type: 'error', message: 'Invalid mnemonic words.' });
        return;
      }

      // Use XEC-specific localStorage key to avoid conflicts
      localStorage.setItem('ecash-mnemonic', sanitized);
      setNotification({
        type: 'success',
        message: 'Mnemonic saved successfully.'
      });
    } catch {
      setNotification({
        type: 'error',
        message: 'Failed to save mnemonic. Please try again.'
      });
    }
  };

  const handleReset = () => {
    const confirmed = window.confirm('Are you sure you want to reset the wallet?');
    if (confirmed) {
      localStorage.removeItem('ecash-mnemonic');
      setMnemonic('');
      setNotification({ type: 'success', message: 'Mnemonic reset successfully.'});
    }
  };

  return (
    <div className="mnemonic-container">
      <h2>Mnemonic</h2>

        {/* Security Warning */}
        <div className="security-notice">
          ⚠️ <strong>Security Notice:</strong> Never share your mnemonic with anyone.
        </div>
      <div className="mnemonic-input-wrapper">
        <input
          id="mnemonic-input"
          type="text"
          value={mnemonic}
          onChange={(e) => setMnemonic(sanitizeInput(e.target.value, 'mnemonic'))}
          className="mnemonic-input"
          disabled={walletConnected || busy} // Disable input when wallet is connected
        />
      </div>
      <div className="mnemonic-actions">
        {!mnemonic.trim() ? (
          // When mnemonic is empty, show only Generate button
          showGenerate && (
            <button
              onClick={handleGenerate}
              className="mnemonic-generate-button"
              disabled={walletConnected || busy} // Disable generate when wallet is connected
            >
              Generate
            </button>
          )
        ) : (
          // When mnemonic has text, show only Save and Reset buttons
          showSave && (
            <>
              <button
                onClick={handleSave}
                className="mnemonic-save-button"
                disabled={walletConnected || busy} // Disable save when wallet is connected
              >
                Save
              </button>
              <button
                onClick={handleReset}
                className="mnemonic-reset-button"
                disabled={walletConnected || busy} // Disable reset when wallet is connected
              >
                Reset
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
};

// PropTypes validation
Mnemonic.propTypes = {
  showSave: PropTypes.bool, // Whether to display 'Save', 'Reset' buttons
  showGenerate: PropTypes.bool, // Whether to display 'Generate' button
};

export default Mnemonic;