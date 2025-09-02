import { useState, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { signMsg, verifyMsg, fromHex } from 'ecash-lib';
import { walletAtom, walletConnectedAtom, notificationAtom, busyAtom } from '../atoms';
import { isValidXECAddress } from '../utils/validation';
import '../styles/signverifymsg.css';

const SignVerifyMsg = () => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [busy, setBusy] = useAtom(busyAtom);
  const setNotification = useSetAtom(notificationAtom);

  // Component state
  const [mode, setMode] = useState('sign'); // 'sign' or 'verify'
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [verifyAddress, setVerifyAddress] = useState('');
  const [verifySignature, setVerifySignature] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const MAX_MESSAGE_LENGTH = 200;

  // Handle mode toggle
  const toggleMode = () => {
    const newMode = mode === 'sign' ? 'verify' : 'sign';
    
    // Debug wallet structure for address resolution
    console.log('🔧 SignVerifyMsg toggleMode debug:', {
      newMode,
      wallet: wallet,
      walletInfo: wallet?.walletInfo,
      xecAddress: wallet?.walletInfo?.xecAddress,
      addressFallback: wallet?.walletInfo?.address,
      walletConnected: walletConnected
    });
    
    setMode(newMode);
    // Reset state when switching modes
    setMessage('');
    setSignature('');
    setVerifySignature('');
    setVerificationResult(null);
    
    // Always populate address with wallet address when switching to verify mode
    // Use correct wallet path with fallback (same pattern as Address.jsx)
    const walletAddress = wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address;
    
    if (newMode === 'verify') {
      if (walletAddress) {
        console.log('✅ Setting verify address to:', walletAddress);
        setVerifyAddress(walletAddress);
      } else {
        console.log('❌ No wallet address found for verify mode');
        setVerifyAddress('');
      }
    } else if (newMode === 'sign') {
      console.log('🧹 Clearing address when switching to sign mode');
      setVerifyAddress(''); // Clear address when switching to sign mode
    }
  };

  // Handle message input change
  const handleMessageChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
    }
  };

  // Handle sign message
  const handleSign = async () => {
    if (!message.trim()) {
      setNotification({ type: 'error', message: 'Please enter a message to sign.' });
      return;
    }

    if (!walletConnected || !wallet) {
      setNotification({ type: 'error', message: 'Wallet not connected.' });
      return;
    }

    setLoading(true);
    setBusy(true);

    try {
      // Get wallet's private key in hex format - correct path is wallet.walletInfo.privateKey
      const privateKeyHex = wallet?.walletInfo?.privateKey;

      if (!privateKeyHex) {
        console.error('Wallet debug:', {
          wallet: wallet,
          walletInfo: wallet?.walletInfo,
          privateKey: wallet?.walletInfo?.privateKey
        });
        throw new Error('Wallet private key not found. Please ensure your wallet is properly connected.');
      }

      // Convert hex private key to Uint8Array for ecash-lib
      const privateKeyUint8Array = fromHex(privateKeyHex);

      // Sign the message using ecash-lib
      const signedMessage = signMsg(message.trim(), privateKeyUint8Array);

      if (!signedMessage) {
        throw new Error('Failed to generate signature');
      }

      setSignature(signedMessage);
      const walletAddress = wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address;
      setNotification({
        type: 'success',
        message: `Message signed successfully with address ${walletAddress}`
      });
    } catch (error) {
      console.error('Error signing message:', error);
      setNotification({
        type: 'error',
        message: `Failed to sign message: ${error.message}`
      });
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  // Handle verify message
  const handleVerify = async () => {
    if (!message.trim()) {
      setNotification({ type: 'error', message: 'Please enter a message to verify.' });
      return;
    }

    if (!verifyAddress.trim()) {
      setNotification({ type: 'error', message: 'Please enter an address.' });
      return;
    }

    if (!verifySignature.trim()) {
      setNotification({ type: 'error', message: 'Please enter a signature.' });
      return;
    }

    setLoading(true);
    setBusy(true);

    try {
      // Validate XEC address format using existing validation utility
      const isValidAddr = isValidXECAddress(verifyAddress.trim());
      if (!isValidAddr) {
        throw new Error('Invalid XEC address format. Address must be in ecash: format.');
      }

      // Verify the signature using ecash-lib
      const verificationResult = verifyMsg(
        message.trim(),
        verifySignature.trim(),
        verifyAddress.trim()
      );

      // Set the verification result (boolean)
      setVerificationResult(Boolean(verificationResult));

      setNotification({
        type: verificationResult ? 'success' : 'error',
        message: `Signature verification: ${verificationResult ? 'VALID' : 'INVALID'}`
      });
    } catch (error) {
      console.error('Error verifying message:', error);
      setVerificationResult(false);
      setNotification({
        type: 'error',
        message: `Verification failed: ${error.message}`
      });
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  // Copy signature to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotification({ type: 'success', message: 'Copied to clipboard!' });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setNotification({ type: 'error', message: 'Failed to copy to clipboard.' });
    }
  };

  // Initialize verify address when wallet connects or mode changes
  useEffect(() => {
    const walletAddress = wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address;
    
    console.log('🔧 SignVerifyMsg useEffect debug:', {
      mode,
      walletAddress,
      currentVerifyAddress: verifyAddress,
      walletConnected,
      walletInfo: wallet?.walletInfo
    });
    
    if (mode === 'verify' && walletAddress) {
      console.log('✅ useEffect setting verify address to:', walletAddress);
      setVerifyAddress(walletAddress);
    }
  }, [mode, wallet?.walletInfo?.xecAddress, wallet?.walletInfo?.address, walletConnected]);

  return (
    <div className="sign-verify-msg">
      {/* Mode Selection - SLP/BCH Style Switch */}
      <div className="switch-container">
        <div className="switch">
          <input
            type="radio"
            id="sign"
            name="signverify-mode"
            value="sign"
            checked={mode === 'sign'}
            onChange={(e) => {
              if (e.target.checked) {
                setMode('sign');
                // Reset state when switching modes
                setMessage('');
                setSignature('');
                setVerifySignature('');
                setVerificationResult(null);
                setVerifyAddress('');
              }
            }}
            disabled={loading}
          />
          <label htmlFor="sign">Sign</label>

          <input
            type="radio"
            id="verify"
            name="signverify-mode"
            value="verify"
            checked={mode === 'verify'}
            onChange={(e) => {
              if (e.target.checked) {
                setMode('verify');
                // Reset state when switching modes
                setMessage('');
                setSignature('');
                setVerifySignature('');
                setVerificationResult(null);
                // Always populate address with wallet address when switching to verify mode
                const walletAddress = wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address;
                if (walletAddress) {
                  setVerifyAddress(walletAddress);
                }
              }
            }}
            disabled={loading}
          />
          <label htmlFor="verify">Verify</label>

          <div className="toggle"></div>
        </div>
      </div>

      {/* Message Input */}
      <div className="input-group">
        <label htmlFor="message">
          {mode === 'sign' ? 'Message to Sign' : 'Message to Verify'}
        </label>
        <textarea
          id="message"
          value={message}
          onChange={handleMessageChange}
          placeholder={mode === 'sign' ? 'Enter message to sign...' : 'Enter message to verify...'}
          rows={4}
          disabled={loading}
        />
        <div className="char-counter">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </div>
      </div>

      {/* Verify Mode Additional Fields */}
      {mode === 'verify' && (
        <>
          <div className="input-group">
            <label htmlFor="verifyAddress">Address</label>
            <input
              id="verifyAddress"
              type="text"
              value={verifyAddress}
              onChange={(e) => setVerifyAddress(e.target.value)}
              placeholder="Enter address to verify signature..."
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="verifySignature">Signature</label>
            <textarea
              id="verifySignature"
              value={verifySignature}
              onChange={(e) => setVerifySignature(e.target.value)}
              placeholder="Enter signature to verify..."
              rows={3}
              disabled={loading}
            />
          </div>
        </>
      )}

      {/* Action Button */}
      <div className="button-group">
        <button
          className="action-button"
          onClick={mode === 'sign' ? handleSign : handleVerify}
          disabled={loading || busy || !walletConnected}
        >
          {loading ? `${mode === 'sign' ? 'Signing' : 'Verifying'}...` : mode === 'sign' ? 'Sign' : 'Verify'}
        </button>
      </div>

      {/* Sign Mode Result */}
      {mode === 'sign' && signature && (
        <div className="signature-simple">
          <div className="signature-text">{signature}</div>
          <button
            className="copy-button-simple"
            onClick={() => copyToClipboard(signature)}
            title="Copy signature to clipboard"
          >
            📋
          </button>
        </div>
      )}

      {/* Verify Mode Result */}
      {mode === 'verify' && verificationResult !== null && (
        <div className={`verification-result ${verificationResult ? 'valid' : 'invalid'}`}>
          <span className="result-icon">
            {verificationResult ? '✅' : '❌'}
          </span>
          <span className="result-text">
            Signature {verificationResult ? 'VALID' : 'INVALID'}
          </span>
        </div>
      )}

      {/* Wallet Connection Warning */}
      {!walletConnected && (
        <div className="warning-message">
          <p>⚠️ Please connect your wallet to sign messages.</p>
        </div>
      )}
    </div>
  );
};

export default SignVerifyMsg;