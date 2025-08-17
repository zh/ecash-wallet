import { useState, useEffect, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { walletAtom, notificationAtom } from '../atoms';
import '../styles/walletdetails.css';

const WalletDetails = () => {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const [wallet] = useAtom(walletAtom);
  const setNotification = useSetAtom(notificationAtom);
  const [wifPrivateKey, setWifPrivateKey] = useState('Converting...');

  // Utility Functions
  const getETokenAddress = (xecAddress) => {
    if (!xecAddress || !xecAddress.startsWith('ecash:')) {
      return 'N/A';
    }
    return xecAddress.replace('ecash:', 'etoken:');
  };

  // Base58 encoding function
  const base58Encode = useCallback((bytes) => {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = alphabet.length;

    // Convert bytes to big integer
    let num = 0n;
    for (let i = 0; i < bytes.length; i++) {
      num = num * 256n + BigInt(bytes[i]);
    }

    // Encode to base58
    let encoded = '';
    while (num > 0) {
      const remainder = num % BigInt(base);
      num = num / BigInt(base);
      encoded = alphabet[Number(remainder)] + encoded;
    }

    // Add leading zeros as '1's
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
      encoded = '1' + encoded;
    }

    return encoded;
  }, []);

  // Hex to WIF conversion function
  const hexToWIF = useCallback((hexKey, crypto) => {
    try {
      // Convert hex string to byte array
      const privateKeyBytes = [];
      for (let i = 0; i < hexKey.length; i += 2) {
        privateKeyBytes.push(parseInt(hexKey.substr(i, 2), 16));
      }

      // Create payload: version(0x80) + private key + compression flag(0x01)
      const payload = [0x80, ...privateKeyBytes, 0x01];

      // Double SHA256 hash for checksum
      const hash1Words = crypto.SHA256(crypto.lib.WordArray.create(payload));
      const hash2Words = crypto.SHA256(hash1Words);

      // Convert hash to bytes and take first 4 bytes as checksum
      const hash2Hex = hash2Words.toString(crypto.enc.Hex);
      const checksum = [];
      for (let i = 0; i < 8; i += 2) {
        checksum.push(parseInt(hash2Hex.substr(i, 2), 16));
      }

      // Combine payload + checksum
      const fullPayload = [...payload, ...checksum];

      // Encode to Base58
      return base58Encode(fullPayload);
    } catch (error) {
      console.error('WIF encoding error:', error);
      return null;
    }
  }, [base58Encode]);

  // Convert hex to WIF asynchronously
  useEffect(() => {
    const convertHexToWIF = async () => {
      const hexPrivateKey = wallet?.walletInfo?.privateKey;

      // If wallet already has WIF format, use it
      if (wallet?.walletInfo?.privateKeyWif) {
        setWifPrivateKey(wallet.walletInfo.privateKeyWif);
        return;
      }

      // If wallet stores WIF in privateKey field (starts with K, L, or 5)
      if (hexPrivateKey && (hexPrivateKey.startsWith('K') || hexPrivateKey.startsWith('L') || hexPrivateKey.startsWith('5'))) {
        setWifPrivateKey(hexPrivateKey);
        return;
      }

      // Convert hex format to WIF using proper crypto conversion
      if (hexPrivateKey && hexPrivateKey.length === 64 && /^[a-fA-F0-9]+$/.test(hexPrivateKey)) {
        try {
          if (window.MinimalXecWallet) {
            const tempWallet = new window.MinimalXecWallet();
            const crypto = tempWallet.crypto;

            console.log('🔧 Converting hex to WIF:', hexPrivateKey.substring(0, 10) + '...');

            const wif = hexToWIF(hexPrivateKey, crypto);
            if (wif && (wif.startsWith('K') || wif.startsWith('L') || wif.startsWith('5'))) {
              console.log('🔧 Successfully converted to WIF:', wif.substring(0, 10) + '...');
              setWifPrivateKey(wif);
              return;
            }
          }

          console.log('🔧 WIF conversion failed, using hex');
          setWifPrivateKey(hexPrivateKey);
        } catch (error) {
          console.error('🔧 Failed to convert hex to WIF:', error);
          setWifPrivateKey(hexPrivateKey);
        }
      } else {
        setWifPrivateKey(hexPrivateKey || 'N/A');
      }
    };

    if (wallet?.walletInfo?.privateKey) {
      convertHexToWIF();
    }
  }, [wallet?.walletInfo?.privateKey, wallet?.walletInfo?.privateKeyWif, hexToWIF]);

  const getWIFFromHex = () => {
    return wifPrivateKey;
  };

  const handleCopyClick = (text, label) => {
    // Prevent event bubbling that might interfere with wallet state
    if (!text || text === 'N/A') return;

    try {
      // Use the older document.execCommand as fallback to avoid async issues
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setNotification({ type: 'success', message: `${label} copied!` });
        }).catch(() => {
          fallbackCopy(text, label);
        });
      } else {
        fallbackCopy(text, label);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      setNotification({ type: 'error', message: 'Copy failed' });
    }
  };

  const fallbackCopy = (text, label) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setNotification({ type: 'success', message: `${label} copied!` });
    } catch (error) {
      console.error('Fallback copy failed:', error);
      setNotification({ type: 'error', message: 'Copy failed' });
    }
  };

  // Wallet data - only essential fields
  const walletData = {
    mnemonic: wallet?.walletInfo?.mnemonic || 'N/A',
    xecAddress: wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address || 'N/A',
    eTokenAddress: getETokenAddress(wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address),
    privateKeyWIF: getWIFFromHex(),
    hdPath: wallet?.walletInfo?.hdPath || "m/44'/899'/0'/0/0"
  };

  return (
    <div className="walletdetails-info">
      <div className="wallet-detail-item">
        <span className="wallet-detail-label">Mnemonic:</span>
        <div className="wallet-detail-value-group">
          <span className="wallet-detail-value">{walletData.mnemonic}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyClick(walletData.mnemonic, 'Mnemonic');
            }}
            className="wallet-action-button small"
            title="Copy to clipboard"
            disabled={walletData.mnemonic === 'N/A'}
          >
            📋
          </button>
        </div>
      </div>

      <div className="wallet-detail-item">
        <span className="wallet-detail-label">XEC Address:</span>
        <div className="wallet-detail-value-group">
          <span className="wallet-detail-value">{walletData.xecAddress}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyClick(walletData.xecAddress, 'XEC Address');
            }}
            className="wallet-action-button small"
            title="Copy to clipboard"
            disabled={walletData.xecAddress === 'N/A'}
          >
            📋
          </button>
        </div>
      </div>

      <div className="wallet-detail-item">
        <span className="wallet-detail-label">eToken Address:</span>
        <div className="wallet-detail-value-group">
          <span className="wallet-detail-value">{walletData.eTokenAddress}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyClick(walletData.eTokenAddress, 'eToken Address');
            }}
            className="wallet-action-button small"
            title="Copy to clipboard"
            disabled={walletData.eTokenAddress === 'N/A'}
          >
            📋
          </button>
        </div>
      </div>

      <div className="wallet-detail-item">
        <span className="wallet-detail-label">Private Key (WIF):</span>
        <div className="wallet-detail-value-group">
          <span className="wallet-detail-value">{walletData.privateKeyWIF}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyClick(walletData.privateKeyWIF, 'Private Key');
            }}
            className="wallet-action-button small"
            title="Copy to clipboard"
            disabled={walletData.privateKeyWIF === 'N/A'}
          >
            📋
          </button>
        </div>
      </div>

      <div className="wallet-detail-item">
        <span className="wallet-detail-label">HD Path:</span>
        <div className="wallet-detail-value-group">
          <span className="wallet-detail-value">{walletData.hdPath}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyClick(walletData.hdPath, 'HD Path');
            }}
            className="wallet-action-button small"
            title="Copy to clipboard"
            disabled={walletData.hdPath === 'N/A'}
          >
            📋
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletDetails;