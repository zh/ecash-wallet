import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAtom, useSetAtom } from 'jotai';
import {
  walletAtom,
  walletConnectedAtom,
  eTokensAtom,
  notificationAtom,
  busyAtom,
  balanceRefreshTriggerAtom
} from '../atoms';
import QrCodeScanner from './QrCodeScanner';
import { sanitizeInput, isValidXECAddress, isValidAmount, isValidTokenId } from '../utils/validation';
import { handleError, safeAsyncOperation } from '../utils/errorHandler';
import '../styles/sendxec.css';

const SendTokens = ({ preSelectedToken = null }) => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [eTokens] = useAtom(eTokensAtom);
  const setNotification = useSetAtom(notificationAtom);
  const [busy, setBusy] = useAtom(busyAtom);
  const setBalanceRefreshTrigger = useSetAtom(balanceRefreshTriggerAtom);

  const [sendForm, setSendForm] = useState({
    tokenId: '',
    address: '',
    amount: ''
  });
  const [showScanner, setShowScanner] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
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

  // Set preselected token when provided (for zoomed TokenCard usage)
  useEffect(() => {
    if (preSelectedToken && preSelectedToken.tokenId) {
      setSendForm(prev => ({
        ...prev,
        tokenId: preSelectedToken.tokenId
      }));
      setSelectedToken(preSelectedToken);
    }
  }, [preSelectedToken]);

  // Update selected token when token selection changes
  useEffect(() => {
    if (sendForm.tokenId && eTokens.length > 0) {
      const token = eTokens.find(t => t.tokenId === sendForm.tokenId);
      setSelectedToken(token || null);
    } else if (!preSelectedToken) {
      setSelectedToken(null);
    }
  }, [sendForm.tokenId, eTokens, preSelectedToken]);

  const handleInputChange = (field, value) => {
    setSendForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatTokenBalance = (balance, decimals = 0) => {
    if (!balance || balance === 0) return '0';

    const divisor = Math.pow(10, decimals);
    const formatted = (balance / divisor).toFixed(Math.min(decimals, 8));

    // Remove trailing zeros
    return formatted.replace(/\.?0+$/, '');
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

    // Prevent rapid consecutive transactions
    if (countdown > 0) {
      setNotification({
        type: 'error',
        message: `Please wait ${countdown} seconds before sending another transaction.`
      });
      return;
    }

    try {
      // Validate and sanitize inputs
      const sanitizedTokenId = sanitizeInput(sendForm.tokenId, 'tokenId');
      const sanitizedRecipient = sanitizeInput(sendForm.address, 'address');
      const sanitizedAmount = sanitizeInput(sendForm.amount, 'amount');

      if (!sanitizedTokenId) {
        setNotification({ type: 'error', message: 'Please select a token to send.' });
        return;
      }

      if (!isValidTokenId(sanitizedTokenId)) {
        setNotification({ type: 'error', message: 'Invalid token ID format.' });
        return;
      }

      if (!sanitizedRecipient) {
        setNotification({ type: 'error', message: 'Recipient address cannot be empty.' });
        return;
      }

      if (!isValidXECAddress(sanitizedRecipient)) {
        setNotification({ type: 'error', message: 'Invalid recipient address format.' });
        return;
      }

      if (!isValidAmount(sanitizedAmount, 'etoken')) {
        setNotification({ type: 'error', message: 'Invalid amount. Please enter a valid number.' });
        return;
      }

      const amount = parseFloat(sanitizedAmount);
      if (amount <= 0) {
        setNotification({ type: 'error', message: 'Amount must be greater than zero.' });
        return;
      }

      // Check if we have enough balance
      if (!selectedToken) {
        setNotification({ type: 'error', message: 'Token not found in your wallet.' });
        return;
      }

      const tokenBalance = selectedToken.balance || 0;
      const divisor = Math.pow(10, selectedToken.decimals || 0);

      // Check balance in atoms but use display amount for transaction
      // const amountInAtoms = Math.round(amount * divisor);
      if (amount > tokenBalance) {
        setNotification({
          type: 'error',
          message: `Insufficient token balance. You have ${tokenBalance} ${selectedToken.symbol || 'tokens'}.`
        });
        return;
      }

      setBusy(true);

      const result = await safeAsyncOperation(
        async () => {
          // Ensure wallet is initialized
          if (!wallet.isInitialized) {
            await wallet.initialize();
          }

          // Refresh wallet UTXOs before sending to avoid stale UTXO mempool conflicts
          await wallet.initialize();

          // Verify token balance after refresh
          const refreshedTokens = await wallet.listETokens();
          const refreshedToken = refreshedTokens.find(t => t.tokenId === sanitizedTokenId);
          if (!refreshedToken) {
            throw new Error('Token not found after UTXO refresh. Please check your token balance.');
          }


          // Send tokens

          const outputs = [{
            address: sanitizedRecipient,
            amount: amount // Use display amount, not atoms
          }];

          // Try wallet.sendETokens with fee rate (primary method from CLI)
          let txid;
          try {
            txid = await wallet.sendETokens(sanitizedTokenId, outputs, 2.0);
          } catch {

            // Fallback to hybridTokens.sendTokens (CLI pattern)
            txid = await wallet.hybridTokens.sendTokens(
              sanitizedTokenId,
              outputs,
              {
                mnemonic: wallet.walletInfo.mnemonic,
                xecAddress: wallet.walletInfo.xecAddress,
                hdPath: wallet.walletInfo.hdPath,
                privateKey: wallet.walletInfo.privateKey,
                publicKey: wallet.walletInfo.publicKey
              },
              wallet.utxos.utxoStore.xecUtxos,
              2.0
            );
          }

          return txid;
        },
'send_tokens'
      );

      // Record successful transaction time
      setLastTransactionTime(Date.now());

      // Trigger balance refresh after successful transaction
      setBalanceRefreshTrigger(Date.now());

      // Reset form and show success
      setSendForm({
        tokenId: '',
        address: '',
        amount: ''
      });
      setSelectedToken(null);

      setNotification({
        type: 'success',
        message: `${amount} ${selectedToken.symbol || 'tokens'} sent to ${sanitizedRecipient.substring(0, 15)}...! TXID: ${result.substring(0, 8)}...`
      });

    } catch (error) {
      console.error('Token transaction failed:', error);
      const handledError = handleError(error, 'send_tokens');

      // If error is related to mempool conflicts or UTXO issues, trigger balance refresh
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('txn-mempool-conflict') ||
          errorMessage.includes('mempool conflict') ||
          errorMessage.includes('missing inputs') ||
          errorMessage.includes('inputs-missingorspent')) {
        setBalanceRefreshTrigger(Date.now());
      }

      setNotification({ type: 'error', message: handledError.message });
    } finally {
      setBusy(false);
    }
  };

  const setMaxAmount = () => {
    if (selectedToken) {
      const divisor = Math.pow(10, selectedToken.decimals || 0);
      const maxAmount = (selectedToken.balance || 0) / divisor;
      handleInputChange('amount', maxAmount.toString());
    }
  };

  if (!walletConnected) {
    return (
      <div className="send-tokens-container">
        <h2>Send eTokens</h2>
        <div className="send-tokens-empty">
          <p>Please connect your wallet to send tokens</p>
        </div>
      </div>
    );
  }

  if (!eTokens || eTokens.length === 0) {
    return (
      <div className="send-tokens-container">
        <h2>Send eTokens</h2>
        <div className="send-tokens-empty">
          <h3>No tokens available</h3>
          <p>You don&apos;t have any eTokens to send.</p>
          <p>eTokens will appear here when you receive them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="send-tokens-container">
      <h2>Send eTokens</h2>

      <form onSubmit={handleSend}>
        {/* Token Selection - only show when no preSelectedToken */}
        {!preSelectedToken && (
          <div className="form-group">
            <label htmlFor="token-select" className="form-label">
              Select Token
            </label>
            <select
              id="token-select"
              value={sendForm.tokenId}
              onChange={(e) => handleInputChange('tokenId', e.target.value)}
              disabled={busy}
              className="form-input"
            >
              <option value="">Choose a token...</option>
              {eTokens.map((token) => (
                <option key={token.tokenId} value={token.tokenId}>
                  {token.name} ({token.symbol}) - Balance: {formatTokenBalance(token.balance, token.decimals)}
                </option>
              ))}
            </select>
          </div>
        )}


        {/* Recipient Address */}
        <div className="form-group">
          <label htmlFor="recipient-address" className="form-label">
            Recipient Address
          </label>
          <div className="form-input-group">
            <input
              id="recipient-address"
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

        {/* Amount Input */}
        <div className="form-group">
          <label htmlFor="token-amount" className="form-label">
            Amount
          </label>
          <div className="form-input-group">
            <input
              id="token-amount"
              type="number"
              value={sendForm.amount}
              onChange={(e) => handleInputChange('amount', sanitizeInput(e.target.value, 'amount'))}
              placeholder="Amount to send"
              step="any"
              min="0"
              disabled={busy}
              className="form-input"
            />
            {selectedToken && (
              <button
                type="button"
                onClick={setMaxAmount}
                className="max-button"
                disabled={busy}
              >
                MAX
              </button>
            )}
          </div>
          {selectedToken && (
            <div className="balance-info">
              Available: {selectedToken.balance} {selectedToken.symbol}
            </div>
          )}
        </div>

        {/* Send Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="send-button"
            disabled={
              busy ||
              !sendForm.tokenId ||
              !sendForm.amount ||
              !sendForm.address ||
              !walletConnected ||
              countdown > 0
            }
          >
            {busy ?
              'Sending...' :
              countdown > 0 ?
                `Wait ${countdown}s` :
                'Send Tokens'
            }
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

SendTokens.propTypes = {
  preSelectedToken: PropTypes.shape({
    tokenId: PropTypes.string.isRequired,
    name: PropTypes.string,
    symbol: PropTypes.string,
    balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

export default SendTokens;
