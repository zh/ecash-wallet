// src/components/SweepXEC.jsx
import { useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { notificationAtom, busyAtom, walletAtom, walletConnectedAtom } from '../atoms';
import QrCodeScanner from './QrCodeScanner';
import { isValidWIF, sanitizeInput } from '../utils/validation';
import '../styles/sweep.css';

const SweepXEC = () => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [busy, setBusy] = useAtom(busyAtom);
  const setNotification = useSetAtom(notificationAtom);

  // State management
  const [sweepKey, setSweepKey] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [phase, setPhase] = useState('input'); // 'input', 'checking', 'confirm', 'sweeping'
  const [paperWalletInfo, setPaperWalletInfo] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Handle QR code scan result
  const handleAddressDetected = (scannedData) => {
    if (!walletConnected) {
      setNotification({ type: 'error', message: 'Wallet is not connected.' });
      return;
    }

    try {
      let key = '';

      if (Array.isArray(scannedData) && scannedData.length > 0) {
        key = scannedData[0].rawValue || scannedData[0].text || scannedData[0];
      } else if (typeof scannedData === 'string') {
        key = scannedData;
      } else if (scannedData && (scannedData.rawValue || scannedData.text)) {
        key = scannedData.rawValue || scannedData.text;
      }

      if (key && typeof key === 'string') {
        const sanitizedKey = sanitizeInput(key.trim(), 'wif');
        setSweepKey(sanitizedKey);
        validateWIF(sanitizedKey);
        setNotification({ type: 'success', message: 'Private key scanned successfully!' });
      } else {
        setNotification({ type: 'error', message: 'Could not extract private key from QR code.' });
      }
    } catch (error) {
      console.error('Error processing scanned data:', error);
      setNotification({ type: 'error', message: 'Error processing QR code data.' });
    }

    setShowScanner(false);
  };

  // Real-time WIF validation
  const validateWIF = (wif) => {
    if (!wif) {
      setValidationError('');
      return false;
    }

    if (!isValidWIF(wif)) {
      setValidationError('Invalid private key format. Must be WIF format (L/K/5/c/9)');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Handle input change with validation
  const handleInputChange = (value) => {
    const sanitized = sanitizeInput(value, 'wif');
    setSweepKey(sanitized);
    validateWIF(sanitized);
  };


  // Check paper wallet balance before sweep
  const checkPaperWallet = async () => {
    if (!validateWIF(sweepKey)) return;

    try {
      setPhase('checking');
      setBusy(true);
      setNotification({ type: 'info', message: 'Checking paper wallet balance...' });

      console.log('🔍 SWEEP DEBUG - Starting balance check for WIF:', sweepKey.substring(0, 10) + '...');

      // Direct WIF import to MinimalXecWallet - no conversion needed!
      console.log('🔍 SWEEP DEBUG - Creating wallet directly from WIF...');
      const tempWallet = new window.MinimalXecWallet(sweepKey);

      console.log('🔍 SWEEP DEBUG - Created MinimalXecWallet instance from WIF');

      await tempWallet.walletInfoPromise;
      console.log('🔍 SWEEP DEBUG - Wallet info promise resolved');

      // Validate wallet was created successfully
      if (!tempWallet.walletInfo?.xecAddress) {
        throw new Error('Invalid private key - could not derive address');
      }

      const derivedAddress = tempWallet.walletInfo.xecAddress;
      console.log('✅ SWEEP - Derived address:', derivedAddress);

      const xecBalance = await tempWallet.getXecBalance();
      console.log('✅ SWEEP - Balance found:', xecBalance, 'XEC');

      if (xecBalance === 0) {
        console.log('🔍 SWEEP DEBUG - Balance is zero, showing warning');
        setNotification({ type: 'warning', message: 'Paper wallet has zero balance' });
        setPhase('input');
        return;
      }

      // Check if trying to sweep to same address
      if (tempWallet.walletInfo.xecAddress === wallet.walletInfo.xecAddress) {
        setNotification({ type: 'error', message: 'Cannot sweep to the same address' });
        setPhase('input');
        return;
      }

      setPaperWalletInfo({
        address: tempWallet.walletInfo.xecAddress,
        xecBalance,
        targetAddress: wallet.walletInfo.xecAddress
      });

      setPhase('confirm');
      setNotification({ type: 'success', message: `Found ${xecBalance.toFixed(2)} XEC in paper wallet` });
    } catch (error) {
      console.error('🔍 SWEEP DEBUG - Error in checkPaperWallet:', error);
      console.error('🔍 SWEEP DEBUG - Error message:', error.message);
      console.error('🔍 SWEEP DEBUG - Error stack:', error.stack);
      console.error('🔍 SWEEP DEBUG - Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      let errorMessage = 'Failed to check paper wallet balance';

      if (error.message.includes('Invalid private key')) {
        errorMessage = 'Invalid private key format';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network error. Please check your connection.';
      }

      console.log('🔍 SWEEP DEBUG - Final error message:', errorMessage);
      setNotification({ type: 'error', message: errorMessage });
      setPhase('input');
    } finally {
      setBusy(false);
    }
  };

  // Execute the sweep
  const handleSweep = async () => {
    if (!paperWalletInfo) return;

    try {
      setPhase('sweeping');
      setBusy(true);
      setNotification({ type: 'info', message: 'Sweeping funds...' });

      // Direct WIF import for sweeping - no conversion needed!
      const tempWallet = new window.MinimalXecWallet(sweepKey);
      await tempWallet.walletInfoPromise;

      // Use sendAllXec to sweep all funds
      const txid = await tempWallet.sendAllXec(paperWalletInfo.targetAddress);

      console.log(`Sweep completed - TXID: ${txid}`);
      console.log(`Explorer: https://explorer.e.cash/tx/${txid}`);

      setNotification({
        type: 'success',
        message: `Swept ${paperWalletInfo.xecBalance.toFixed(2)} XEC successfully! TXID: ${txid.substring(0, 8)}...`
      });

      // Reset state
      resetSweepState();
    } catch (error) {
      console.error('Error sweeping wallet:', error);
      setNotification({ type: 'error', message: 'Failed to sweep wallet: ' + error.message });
      setPhase('confirm');
    } finally {
      setBusy(false);
    }
  };

  // Reset all state
  const resetSweepState = () => {
    setSweepKey('');
    setPaperWalletInfo(null);
    setValidationError('');
    setPhase('input');
    setShowScanner(false);
  };

  // Cancel operation
  const handleCancel = () => {
    if (busy) return;
    resetSweepState();
  };

  // Render different phases
  const renderInputPhase = () => (
    <>
      <div className="form-group">
        <label htmlFor="private-key" className="form-label">
          Private Key (WIF)
        </label>
        <div className="form-input-group">
          <input
            id="private-key"
            type="text"
            value={sweepKey}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={busy}
            className={`form-input ${validationError ? 'error' : ''}`}
            placeholder="Enter WIF private key (L/K/5/c/9...)"
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={busy}
            className="scan-button"
            title="Scan QR code"
          >
            QR Scan
          </button>
        </div>
        {validationError && (
          <div className="validation-error">
            {validationError}
          </div>
        )}
        {sweepKey && !validationError && (
          <div className="validation-success">
            ✓ Valid WIF format
          </div>
        )}
      </div>

      {showScanner && (
        <div className="qr-scanner-modal">
          <div className="qr-scanner-header">
            <h3>Scan Private Key QR Code</h3>
            <button
              type="button"
              disabled={busy}
              className="close-scanner-button"
              onClick={() => setShowScanner(false)}
            >
              ✕
            </button>
          </div>
          <QrCodeScanner onAddressDetected={handleAddressDetected} />
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={checkPaperWallet}
          className="check-button primary-button"
          disabled={!walletConnected || busy || !sweepKey || validationError}
        >
          {busy && phase === 'checking' ? 'Checking...' : 'Check Balance'}
        </button>
      </div>
    </>
  );

  const renderConfirmPhase = () => (
    <>
      <h3>Confirm Sweep Operation</h3>
      <div className="sweep-info">
        <div className="info-row">
          <span className="label">From Address:</span>
          <span className="value monospace">{paperWalletInfo?.address}</span>
        </div>
        <div className="info-row">
          <span className="label">To Address:</span>
          <span className="value monospace">{paperWalletInfo?.targetAddress}</span>
        </div>
        <div className="info-row">
          <span className="label">Amount:</span>
          <span className="value highlight">{paperWalletInfo?.xecBalance?.toFixed(2)} XEC</span>
        </div>
      </div>

      <div className="warning-box">
        <strong>⚠️ Warning:</strong> This operation will move all funds from the paper wallet to your current wallet. This action cannot be undone.
      </div>

      <div className="form-actions">
        <button
          type="button"
          onClick={handleCancel}
          className="cancel-button secondary-button"
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSweep}
          className="sweep-button primary-button"
          disabled={busy}
        >
          {busy && phase === 'sweeping' ? 'Sweeping...' : 'Confirm Sweep'}
        </button>
      </div>
    </>
  );

  return (
    <div className="sweep-container">
      <div className="sweep-header">
        <h2>Sweep Paper Wallet</h2>
        <p className="sweep-description">
          Import all XEC from a paper wallet or private key into your current wallet.
        </p>
      </div>

      <div className="sweep-content">
        {phase === 'input' && renderInputPhase()}
        {phase === 'checking' && renderInputPhase()}
        {(phase === 'confirm' || phase === 'sweeping') && renderConfirmPhase()}
      </div>
    </div>
  );
};

export default SweepXEC;