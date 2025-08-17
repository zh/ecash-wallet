// src/components/SendXEC.jsx
import { useState, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  notificationAtom,
  busyAtom,
  balanceAtom,
  walletAtom,
  walletConnectedAtom,
  balanceRefreshTriggerAtom
} from '../atoms';
import QrCodeScanner from './QrCodeScanner';
import { useXecPrice } from '../hooks';
import { sanitizeInput, isValidXECAddress, isValidAmount } from '../utils/validation';
import { handleError, safeAsyncOperation } from '../utils/errorHandler';
import '../styles/sendxec.css';

const SendXEC = () => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [balance] = useAtom(balanceAtom);
  const setNotification = useSetAtom(notificationAtom);
  const [busy, setBusy] = useAtom(busyAtom);
  const setBalanceRefreshTrigger = useSetAtom(balanceRefreshTriggerAtom);
  const { price: xecUsdPrice } = useXecPrice();

  const [sendForm, setSendForm] = useState({
    address: '',
    amount: '',
    unit: 'xec'
  });
  const [showScanner, setShowScanner] = useState(false);
  const [lastTransactionTime, setLastTransactionTime] = useState(0);
  const [countdown, setCountdown] = useState(0);

  // Update countdown timer for transaction cooldown
  useEffect(() => {
    if (lastTransactionTime === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastTx = now - lastTransactionTime;
      const minInterval = 15000; // 15 seconds
      const remaining = Math.max(0, Math.ceil((minInterval - timeSinceLastTx) / 1000));

      setCountdown(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastTransactionTime]);

  const handleInputChange = (field, value) => {
    setSendForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatBalance = (bal, unit) => {
    if (!bal || bal === 0) return '0';

    switch (unit) {
      case 'sat':
        // Convert XEC to base units (multiply by 100)
        return (bal * 100).toFixed(0);
      case 'usd':
        if (!xecUsdPrice || xecUsdPrice === 0) return '0.00';
        // Balance is already in XEC, multiply by price for USD
        return (bal * xecUsdPrice).toFixed(2);
      case 'xec':
      default:
        // Balance is already in XEC units
        return bal.toFixed(2);
    }
  };

  const convertAmount = (amount, fromUnit) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 0;

    switch (fromUnit) {
      case 'sat':
        // Convert base units to XEC (divide by 100)
        return numAmount / 100;
      case 'usd':
        if (!xecUsdPrice || xecUsdPrice === 0) return 0;
        // Convert USD to XEC
        return numAmount / xecUsdPrice;
      case 'xec':
      default:
        // Amount is already in XEC units
        return numAmount;
    }
  };

  const handleAddressDetected = (scannedData) => {
    if (!walletConnected) {
      setNotification({ type: 'error', message: 'Wallet is not connected.' });
      return;
    }

    try {
      if (Array.isArray(scannedData) && scannedData.length > 0) {
        const rawAddress = scannedData[0].rawValue;
        const sanitizedAddress = sanitizeInput(rawAddress, 'address');

        if (!isValidXECAddress(sanitizedAddress)) {
          setNotification({ type: 'error', message: 'Invalid eCash address format.' });
          return;
        }

        handleInputChange('address', sanitizedAddress);
        setNotification({ type: 'success', message: 'Address scanned successfully.' });
      } else {
        setNotification({ type: 'error', message: 'Could not read QR code data.' });
      }
    } catch (error) {
      const handledError = handleError(error, 'qr_scan');
      setNotification({ type: 'error', message: handledError.message });
    }
    setShowScanner(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();

    console.log('🚀🚀🚀 HANDLE SEND CALLED! 🚀🚀🚀');
    console.log('🚀 Form state:', sendForm);

    if (!walletConnected) {
      setNotification({ type: 'error', message: 'Wallet is not connected.' });
      return;
    }

    // Prevent rapid consecutive transactions (minimum 15 seconds between sends)
    if (countdown > 0) {
      setNotification({
        type: 'error',
        message: `Please wait ${countdown} seconds before sending another transaction.`
      });
      return;
    }

    try {
      // Validate and sanitize inputs
      const sanitizedRecipient = sanitizeInput(sendForm.address, 'address');
      const sanitizedAmount = sanitizeInput(sendForm.amount, 'amount');

      console.log('🚀 handleSend - Original address:', sendForm.address);
      console.log('🚀 handleSend - Sanitized address:', sanitizedRecipient);

      if (!sanitizedRecipient) {
        setNotification({ type: 'error', message: 'Recipient address cannot be empty.' });
        return;
      }

      console.log('🚀 handleSend - About to validate:', sanitizedRecipient);
      const isValid = isValidXECAddress(sanitizedRecipient);
      console.log('🚀 handleSend - Validation result:', isValid);

      if (!isValid) {
        setNotification({ type: 'error', message: 'Invalid recipient address format.' });
        return;
      }

      if (!isValidAmount(sanitizedAmount, sendForm.unit === 'sat' ? 'satoshi' : 'xec')) {
        setNotification({ type: 'error', message: 'Invalid amount. Please enter a valid number.' });
        return;
      }

      const xecAmount = convertAmount(sanitizedAmount, sendForm.unit);
      console.log('🚀 Converted amount to XEC:', xecAmount);

      if (xecAmount < 5.46) {
        setNotification({ type: 'error', message: 'Amount too small. Minimum is 5.46 XEC (546 satoshis).' });
        return;
      }

      console.log('🚀 Balance check:', {
        balance,
        xecAmount,
        balanceType: typeof balance,
        xecAmountType: typeof xecAmount,
        hasSufficientBalance: balance >= xecAmount
      });

      if (xecAmount > balance) {
        setNotification({ type: 'error', message: 'Insufficient balance for this transaction.' });
        return;
      }

      // Convert XEC to satoshis for the API (XEC * 100 = satoshis)
      const amountSat = Math.round(xecAmount * 100);
      console.log('🚀 Amount in satoshis:', amountSat);

      setBusy(true);

      console.log('🚀 About to call wallet.sendXec with:', {
        address: sanitizedRecipient,
        amountSat: amountSat
      });

      // Debug balance before entering safeAsyncOperation
      console.log('🚀 BEFORE safeAsyncOperation - Our balance atom:', balance, 'XEC');
      console.log('🚀 BEFORE safeAsyncOperation - Wallet object:', !!wallet);
      console.log('🚀 BEFORE safeAsyncOperation - Wallet getXecBalance method:', typeof wallet?.getXecBalance);

      try {
        const quickBalanceCheck = await wallet.getXecBalance();
        console.log('🚀 BEFORE safeAsyncOperation - Wallet reports balance:', quickBalanceCheck, 'XEC');
      } catch (balanceError) {
        console.log('🚀 BEFORE safeAsyncOperation - Balance check failed:', balanceError.message);
      }

      const result = await safeAsyncOperation(
        async () => {
          // Check wallet balance right before sending
          console.log('🚀 Checking wallet balance before send...');
          const walletBalance = await wallet.getXecBalance();
          console.log('🚀 Wallet reports balance:', walletBalance, 'XEC');
          console.log('🚀 Our balance atom shows:', balance, 'XEC');
          console.log('🚀 Trying to send:', xecAmount, 'XEC (', amountSat, 'sats)');

          // Refresh wallet UTXOs before sending to avoid stale input errors
          console.log('🚀 Refreshing wallet UTXOs...');
          await wallet.initialize();

          // Force UTXO refresh if needed
          console.log('🚀 Forcing UTXO refresh...');
          if (typeof wallet.refreshUtxos === 'function') {
            await wallet.refreshUtxos();
            console.log('🚀 Called wallet.refreshUtxos()');
          }

          // Try alternative UTXO methods
          if (typeof wallet.updateUtxos === 'function') {
            await wallet.updateUtxos();
            console.log('🚀 Called wallet.updateUtxos()');
          }

          // Check balance again after refresh
          const walletBalanceAfterRefresh = await wallet.getXecBalance();
          console.log('🚀 Wallet balance after refresh:', walletBalanceAfterRefresh, 'XEC');

          // Send using minimal-xec-wallet API (expects outputs array with amountSat)
          console.log('🚀 Calling wallet.sendXec...');
          const outputs = [
            {
              address: sanitizedRecipient,
              amountSat: amountSat  // API expects amountSat in satoshis
            }
          ];
          console.log('🚀 Outputs array:', outputs);

          // Get wallet UTXOs for debugging
          try {
            const utxoResponse = await wallet.getUtxos();
            console.log('🚀 Raw UTXOs response:', typeof utxoResponse, utxoResponse);

            // Handle different UTXO response formats
            let utxosArray = null;
            if (Array.isArray(utxoResponse)) {
              utxosArray = utxoResponse;
            } else if (utxoResponse && utxoResponse.utxos && Array.isArray(utxoResponse.utxos)) {
              utxosArray = utxoResponse.utxos;
            } else if (utxoResponse && utxoResponse.success && utxoResponse.utxos) {
              utxosArray = utxoResponse.utxos;
            }

            if (utxosArray && Array.isArray(utxosArray)) {
              console.log('🚀 Wallet UTXOs count:', utxosArray.length);
              const totalValue = utxosArray.reduce((sum, utxo) => sum + (utxo.satoshis || utxo.value || 0), 0);
              console.log('🚀 Wallet UTXOs total value:', totalValue, 'sats (', (totalValue/100).toFixed(2), 'XEC)');
              if (utxosArray.length > 0) {
                console.log('🚀 All UTXOs:', utxosArray.map(u => ({
                  value: u.satoshis || u.value,
                  txid: u.txid?.slice(0, 8),
                  vout: u.vout
                })));
              }
            } else {
              console.log('🚀 Could not parse UTXOs array from response');
            }
          } catch (utxoError) {
            console.log('🚀 Could not get UTXOs:', utxoError.message);
            console.log('🚀 UTXO error stack:', utxoError.stack);
          }

          const txid = await wallet.sendXec(outputs);
          console.log('🚀 Transaction successful! TXID:', txid);
          return txid;
        },
        'send_xec'
      );

      // Record successful transaction time
      setLastTransactionTime(Date.now());

      // Trigger balance refresh after successful transaction
      setBalanceRefreshTrigger(Date.now());

      // Reset form and show success
      setSendForm({
        address: '',
        amount: '',
        unit: 'xec'
      });

      setNotification({
        type: 'success',
        message: `${xecAmount.toFixed(2)} XEC sent! TXID: ${result.substring(0, 8)}...`
      });
    } catch (error) {
      console.log('🚀 Caught error in handleSend:', error);
      console.log('🚀 Error message:', error.message);
      console.log('🚀 Error stack:', error.stack);
      console.log('🚀 Full error object:', JSON.stringify(error, null, 2));

      const handledError = handleError(error, 'send_transaction');
      console.log('🚀 Handled error:', handledError);

      // If error is related to missing inputs, trigger balance refresh
      if (handledError.category === 'wallet' &&
          (error.message?.toLowerCase().includes('missing inputs') ||
           error.message?.toLowerCase().includes('inputs-missingorspent'))) {
        console.log('🚀 Triggering balance refresh due to UTXO error');
        setBalanceRefreshTrigger(Date.now());
      }

      setNotification({ type: 'error', message: handledError.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sendxec-container">
      <h2>Send XEC</h2>

      <form onSubmit={handleSend}>
          {/* Address Input with QR Scanner */}
          <div className="send-group">
            <div className="form-input-group">
              <input
                type="text"
                value={sendForm.address}
                onChange={(e) => handleInputChange('address', sanitizeInput(e.target.value, 'address'))}
                placeholder="Recipient address (ecash:...)"
                disabled={busy}
                className="form-input"
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="scan-button"
                disabled={busy}
              >
                QR Scan
              </button>
            </div>
            {sendForm.address && sendForm.address.length > 10 && !isValidXECAddress(sendForm.address) && (
              <div className="error-text">
                Invalid eCash address format
              </div>
            )}

            {/* QR Scanner Modal */}
            {showScanner && (
              <div className="qr-scanner-modal">
                <button
                  type="button"
                  disabled={busy}
                  className="close-scanner-button"
                  onClick={() => setShowScanner(false)}
                >
                  Close Scanner
                </button>
                <QrCodeScanner onAddressDetected={handleAddressDetected} />
              </div>
            )}
          </div>

          {/* Amount Input with Unit Selector */}
          <div className="send-group">
            <div className="form-input-group">
              <input
                type="number"
                value={sendForm.amount}
                onChange={(e) => handleInputChange('amount', sanitizeInput(e.target.value, 'amount'))}
                placeholder="Amount"
                step="any"
                min="0"
                disabled={busy}
                className="form-input"
              />
              <select
                value={sendForm.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                disabled={busy}
                className="unit-select"
              >
                <option value="xec">XEC</option>
                <option value="sat">SAT</option>
                <option value="usd">USD</option>
              </select>
            </div>
            <div className="balance-info">
              Available: {formatBalance(balance || 0, sendForm.unit)} {sendForm.unit.toUpperCase()}
            </div>
          </div>

          {/* Send Button */}
          <div className="send-actions">
            <button
              type="submit"
              className="send-button"
              disabled={busy || !sendForm.address || !sendForm.amount || !walletConnected || countdown > 0}
            >
              {busy ? 'Sending...' : countdown > 0 ? `Wait ${countdown}s` : 'Send'}
            </button>
            {countdown > 0 && (
              <div className="cooldown-info" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Preventing rapid transactions to avoid UTXO conflicts
              </div>
            )}
          </div>
        </form>
    </div>
  );
};

export default SendXEC;

