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
      const minInterval = 5000; // 5 seconds
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


    if (!walletConnected) {
      setNotification({ type: 'error', message: 'Wallet is not connected.' });
      return;
    }

    // Prevent rapid consecutive transactions (minimum 5 seconds between sends)
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


      if (!sanitizedRecipient) {
        setNotification({ type: 'error', message: 'Recipient address cannot be empty.' });
        return;
      }

      const isValid = isValidXECAddress(sanitizedRecipient);

      if (!isValid) {
        setNotification({ type: 'error', message: 'Invalid recipient address format.' });
        return;
      }

      if (!isValidAmount(sanitizedAmount, sendForm.unit === 'sat' ? 'satoshi' : 'xec')) {
        setNotification({ type: 'error', message: 'Invalid amount. Please enter a valid number.' });
        return;
      }

      const xecAmount = convertAmount(sanitizedAmount, sendForm.unit);

      if (xecAmount < 5.46) {
        setNotification({ type: 'error', message: 'Amount too small. Minimum is 5.46 XEC (546 satoshis).' });
        return;
      }


      // Quick preliminary balance check for immediate user feedback
      // More realistic fee estimation for complex UTXO sets and potential token dust
      const estimatedFee = 0.3; // Increased from 0.1 to 0.3 XEC for safety margin
      const totalNeeded = xecAmount + estimatedFee;

      if (totalNeeded > balance) {
        setNotification({
          type: 'error',
          message: `Insufficient balance. Need ~${totalNeeded.toFixed(2)} XEC (${xecAmount.toFixed(2)} + ~${estimatedFee} fee), but have ${balance.toFixed(2)} XEC.`
        });
        return;
      }

      setBusy(true);



      const result = await safeAsyncOperation(
        async () => {
          // Refresh wallet UTXOs before sending to get fresh data
          await wallet.initialize();

          // Authoritative balance check with fresh UTXO data using CLI pattern
          const balanceData = await wallet.getDetailedBalance();
          const freshBalance = balanceData.total;

          if (xecAmount > freshBalance) {
            throw new Error(`Insufficient balance after refresh. Need ${xecAmount.toFixed(2)} XEC, but have ${freshBalance.toFixed(2)} XEC.`);
          }

          // Send using CLI's exact working pattern
          // Convert XEC to satoshis (CLI pattern: Math.floor(amountToSend * 100))
          const satoshis = Math.floor(xecAmount * 100);

          // Create output object exactly like CLI
          const outputs = [{
            address: sanitizedRecipient,
            amount: satoshis
          }];

          // Use CLI's exact send method
          const txid = await wallet.sendXec(outputs);
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
      const handledError = handleError(error, 'send_transaction');

      // If error is related to missing inputs, trigger balance refresh
      if (handledError.category === 'wallet' &&
          (error.message?.toLowerCase().includes('missing inputs') ||
           error.message?.toLowerCase().includes('inputs-missingorspent'))) {
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

