# eCash Wallet Development Guide

## Overview

This document contains essential knowledge for developing eCash (XEC) wallets using the minimal-xec-wallet library and related technologies. It includes critical discoveries, solutions, and best practices learned during development.

## MinimalXecWallet Library

### Basic Usage

```javascript
// Create wallet from mnemonic
const wallet = new MinimalXecWallet(mnemonic);
await wallet.walletInfoPromise;

// Create wallet from hex private key
const hexPrivateKey = "a46c1c9a5cf0ec54529867c8ef8a98d217f71b344cc3db124bb9fe90356ca65d";
const wallet = new MinimalXecWallet(hexPrivateKey);
await wallet.walletInfoPromise;

// ✅ NEW: Create wallet directly from WIF
const wifPrivateKey = "L2jKtAA3SfLRQ7rQyNSb7GB8JJs6HdTZytMTFiCKBGZeoe4SvAER";
const wallet = new MinimalXecWallet(wifPrivateKey);
await wallet.walletInfoPromise;

// ✅ NEW: Validate WIF before use
const isValidWIF = wallet.validateWIF(wifPrivateKey);
if (!isValidWIF) throw new Error('Invalid WIF');

// ✅ NEW: Export private key as WIF
const exportedWIF = wallet.exportPrivateKeyAsWIF(true, false); // compressed, mainnet
```

### Wallet Information Structure

```javascript
wallet.walletInfo = {
  privateKey: "hex_private_key_64_chars", // Always hex format
  publicKey: "public_key_hex",
  mnemonic: "twelve word mnemonic phrase...",
  xecAddress: "ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl",
  hdPath: "m/44'/899'/0'/0/0"
}
```

## Critical Issues & Solutions

### 1. WIF Import Functionality ✅ FIXED

**STATUS**: MinimalXecWallet now supports direct WIF import with robust validation.

#### Current Solution (Recommended)
```javascript
// Direct WIF import - now works correctly!
const wallet = new MinimalXecWallet(wifKey);
await wallet.walletInfoPromise;

// Validate WIF before using
const isValid = wallet.validateWIF(wifKey);
if (!isValid) {
  throw new Error('Invalid WIF format');
}
```

#### Legacy Conversion (No Longer Required)
The custom WIF-to-hex conversion is no longer needed but preserved for reference:

```javascript
// This workaround is no longer required as of 2025
// MinimalXecWallet now handles WIF import directly
const wifToHex = (wif) => {
  // Legacy conversion code...
  // Use wifUtils.js instead for any manual conversions
};
```

### 2. WIF Export/Display ✅ ENHANCED

For displaying private keys in WIF format, use the robust utility functions:

```javascript
import { hexToWIF } from '../utils/wifUtils';

// Convert hex private key to WIF for display
const wif = hexToWIF(hexPrivateKey, true, false); // compressed, mainnet

// Export WIF directly from wallet instance
const wif = wallet.exportPrivateKeyAsWIF(true, false); // compressed, mainnet

// Support for different formats
const mainnetCompressed = hexToWIF(hex, true, false);   // K/L prefix
const mainnetUncompressed = hexToWIF(hex, false, false); // 5 prefix  
const testnetCompressed = hexToWIF(hex, true, true);     // c prefix
const testnetUncompressed = hexToWIF(hex, false, true);   // 9 prefix
```

## Address Formats

### eCash Address Prefixes
- **XEC addresses**: `ecash:` prefix
- **eToken addresses**: `etoken:` prefix (same address, different prefix)

### Address Conversion
```javascript
const getETokenAddress = (xecAddress) => {
  if (!xecAddress || !xecAddress.startsWith('ecash:')) {
    return 'N/A';
  }
  return xecAddress.replace('ecash:', 'etoken:');
};
```

## Validation Functions

### WIF Validation ✅ ENHANCED

```javascript
import { isValidWIF, getWifInfo } from '../utils/wifUtils';

// Robust cryptographic validation
export const isValidWIF = (privateKey) => {
  // Now includes cryptographic checksum validation and secp256k1 range checking
  // Supports mainnet and testnet formats: L, K, 5, c, 9
  return isValidWIF(privateKey);
};

// Get detailed WIF information
const wifInfo = getWifInfo(wif);
// Returns: { network: 'mainnet'|'testnet', compressed: boolean, valid: boolean, format: string }
```

### XEC Address Validation
```javascript
export const isValidXECAddress = (address) => {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const sanitized = sanitizeInput(address, 'address');

    // Only allow eCash addresses (ecash: prefix)
    if (!sanitized.startsWith('ecash:')) {
      return false;
    }

    // Use ecashaddrjs to validate the eCash address cryptographically
    if (!ecashaddrjs || typeof ecashaddrjs.decodeCashAddress !== 'function') {
      return false;
    }

    const result = ecashaddrjs.decodeCashAddress(sanitized);
    return true;
  } catch (error) {
    // Invalid address format or decode failed
    return false;
  }
};
```

## Wallet Operations

### Balance Checking
```javascript
const balance = await wallet.getXecBalance();
console.log(`Balance: ${balance} XEC`);
```

### UTXO Management
```javascript
const utxos = await wallet.getUtxos();
console.log('UTXOs:', utxos);
```

### Sending XEC
```javascript
// Send specific amount
const txid = await wallet.send(toAddress, amountInSatoshis);

// Send all funds (sweep)
const txid = await wallet.sendAllXec(toAddress);
```

## Common Patterns

### Wallet State Management (Jotai)
```javascript
import { atom } from 'jotai';

export const walletAtom = atom(null);
export const walletConnectedAtom = atom(false);
export const notificationAtom = atom(null);
```

### Error Handling
```javascript
try {
  const wallet = new MinimalXecWallet(privateKey);
  await wallet.walletInfoPromise;
  
  if (!wallet.walletInfo?.xecAddress) {
    throw new Error('Invalid private key - could not derive address');
  }
  
  const balance = await wallet.getXecBalance();
  // Process balance...
} catch (error) {
  let errorMessage = 'Failed to check wallet';
  
  if (error.message.includes('Invalid private key')) {
    errorMessage = 'Invalid private key format';
  } else if (error.message.includes('network') || error.message.includes('connection')) {
    errorMessage = 'Network error. Please check your connection.';
  }
  
  console.error('Wallet operation failed:', error);
}
```

## Best Practices

### 1. WIF Support in MinimalXecWallet ✅ UPDATED
- **Now Supported**: Direct WIF import to MinimalXecWallet constructor
- **Recommended**: Use robust WIF validation before wallet creation
- **Enhanced**: Support for mainnet and testnet WIF formats
- **Utility Functions**: Use `wifUtils.js` for manual conversions

### 2. Proper Error Handling
- Check for wallet creation success
- Validate addresses before operations
- Handle network errors gracefully

### 3. Security Considerations
- Never log private keys in production
- Sanitize all user inputs
- Use proper validation for all cryptographic operations

### 4. Testing Approach
- Test with known mnemonics and expected addresses
- Verify WIF conversion both ways (WIF→hex→WIF)
- Test network operations with small amounts first

## Integration Setup

### Required Dependencies
```json
{
  "dependencies": {
    "ecashaddrjs": "^2.0.0",
    "crypto-browserify": "^3.12.0",
    "@scure/bip39": "^1.5.4"
  }
}
```

### Vite Configuration
```javascript
// Copy minimal-xec-wallet library to public folder
"script": "cp -f ../../minimal-xec-wallet/dist/minimal-xec-wallet.min.js public/"
```

## Debugging Tips

### Console Logging for Wallet Issues
```javascript
console.log('🔍 WALLET DEBUG - Address:', wallet.walletInfo.xecAddress);
console.log('🔍 WALLET DEBUG - Private key format:', typeof wallet.walletInfo.privateKey);
console.log('🔍 WALLET DEBUG - Private key length:', wallet.walletInfo.privateKey?.length);
console.log('🔍 WALLET DEBUG - Balance:', await wallet.getXecBalance());
```

### Common Issues
1. **Zero balance on valid addresses**: Check network connectivity and address format
2. **Wrong address derivation**: Ensure using hex private key, not WIF
3. **Transaction failures**: Verify sufficient balance and valid recipient address

## Test Cases

### Known Test Wallet
```javascript
const testWallet = {
  mnemonic: "upset borrow key second dial sauce time real album rescue addict venture",
  expectedAddress: "ecash:qz9wjfr4e6aj0cq9akd23jm9nflecjpj8sze2fdyfl",
  expectedWIF: "L2jKtAA3SfLRQ7rQyNSb7GB8JJs6HdTZytMTFiCKBGZeoe4SvAER",
  expectedHex: "a46c1c9a5cf0ec54529867c8ef8a98d217f71b344cc3db124bb9fe90356ca65d",
  expectedBalance: 20 // XEC
};
```

This document will be updated whenever significant discoveries are made during eCash wallet development.

---
*Last updated: 2025-08-18 - ✅ FIXED: MinimalXecWallet WIF import now works directly. Enhanced with robust cryptographic validation and testnet support. Replaced custom Base58 implementations with tested library code.*