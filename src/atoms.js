import { atom } from 'jotai';
import { loadMnemonic, saveMnemonic } from './utils/mnemonicStorage';

// HD derivation path atoms - create a writable atom with localStorage persistence
const getInitialDerivationMode = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ecash-derivation-mode');
    return saved || 'standard';
  }
  return 'standard';
};

const _derivationModeAtom = atom(getInitialDerivationMode());

export const derivationModeAtom = atom(
  (get) => get(_derivationModeAtom),
  (get, set, newMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ecash-derivation-mode', newMode);
    }
    set(_derivationModeAtom, newMode);
  }
);
derivationModeAtom.debugLabel = 'derivationModeAtom';

export const hdPathAtom = atom((get) => {
  const mode = get(derivationModeAtom);
  return mode === 'cashtab' ? "m/44'/1899'/0'/0/0" : "m/44'/899'/0'/0/0";
});
hdPathAtom.debugLabel = 'hdPathAtom';


// Analytics options atom for wallet health and analytics features
export const analyticsEnabledAtom = atom(true);
analyticsEnabledAtom.debugLabel = 'analyticsEnabledAtom';

// XEC wallet options - includes HD path and analytics configuration
export const optionsAtom = atom((get) => {
  const hdPath = get(hdPathAtom);
  const analyticsEnabled = get(analyticsEnabledAtom);

  return {
    hdPath,
    // Enable analytics features for health monitoring and UTXO classification
    utxoAnalytics: analyticsEnabled ? {
      enabled: true,
      classificationConfig: {
        ageThresholds: {
          mature: 144,     // 24 hours at 10-minute blocks
          old: 1008        // 1 week at 10-minute blocks
        },
        valueThresholds: {
          dust: 546,       // BCH dust limit
          small: 10000,    // 0.1 XEC
          medium: 100000   // 1 XEC
        }
      },
      healthMonitorConfig: {
        dustThreshold: 546,
        alertThresholds: {
          dust: 0.1,       // Alert if >10% dust UTXOs
          privacy: 50      // Alert if >50 UTXOs (privacy concern)
        }
      }
    } : undefined,
    // minimal-xec-wallet handles Chronik connection internally
    noUpdate: true,
  };
});
optionsAtom.debugLabel = 'optionsAtom';


export const walletConnectedAtom = atom(false);
walletConnectedAtom.debugLabel = 'walletConnectedAtom';

// Atom to store the XEC wallet instance
export const walletAtom = atom(null);
walletAtom.debugLabel = 'walletAtom';

// eTokens instead of SLP tokens
export const eTokensAtom = atom([]);
eTokensAtom.debugLabel = 'eTokensAtom';

// XEC price in USD
export const priceAtom = atom(0);
priceAtom.debugLabel = 'priceAtom';

// XEC balance (in XEC units - 2 decimal places, from wallet.getXecBalance())
// Spendable balance (pure XEC only, excludes token dust)
export const balanceAtom = atom(0);
balanceAtom.debugLabel = 'balanceAtom';

// Total balance (all UTXOs including token dust)
export const totalBalanceAtom = atom(0);
totalBalanceAtom.debugLabel = 'totalBalanceAtom';

// Balance breakdown for detailed display
export const balanceBreakdownAtom = atom({
  spendableBalance: 0,
  totalBalance: 0,
  tokenDustValue: 0,
  pureXecUtxos: 0,
  tokenUtxos: 0
});
balanceBreakdownAtom.debugLabel = 'balanceBreakdownAtom';

// Refresh trigger atoms
export const balanceRefreshTriggerAtom = atom(0);
balanceRefreshTriggerAtom.debugLabel = 'balanceRefreshTriggerAtom';

export const eTokensRefreshTriggerAtom = atom(null, (get, set) => {
  set(eTokensAtom, get(eTokensAtom));
});
eTokensRefreshTriggerAtom.debugLabel = 'eTokensRefreshTriggerAtom';

export const busyAtom = atom(false);
busyAtom.debugLabel = 'busyAtom';

export const notificationAtom = atom(null);
notificationAtom.debugLabel = 'notificationAtom';

// Atoms for script loading state
export const scriptLoadedAtom = atom(false);
scriptLoadedAtom.debugLabel = 'scriptLoadedAtom';

export const scriptErrorAtom = atom(null);
scriptErrorAtom.debugLabel = 'scriptErrorAtom';

// No server management needed - Chronik handles infrastructure

// Advanced settings atoms
export const settingsAtom = atom({
});
settingsAtom.debugLabel = 'settingsAtom';

// Manual refresh trigger atoms
export const manualBalanceRefreshAtom = atom(null, (get, set) => {
  const current = get(balanceRefreshTriggerAtom);
  set(balanceRefreshTriggerAtom, current + 1);
});
manualBalanceRefreshAtom.debugLabel = 'manualBalanceRefreshAtom';

// Theme management atom with localStorage persistence
const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('ecash-wallet-theme');
    return savedTheme || 'light'; // Default to light theme
  }
  return 'light';
};

export const themeAtom = atom(getInitialTheme());
themeAtom.debugLabel = 'themeAtom';

// Theme setter atom that also persists to localStorage
export const themeSetterAtom = atom(null, (get, set, newTheme) => {
  set(themeAtom, newTheme);
  if (typeof window !== 'undefined') {
    localStorage.setItem('ecash-wallet-theme', newTheme);
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', newTheme);
  }
});
themeSetterAtom.debugLabel = 'themeSetterAtom';

// Wallet health and analytics atoms
export const walletHealthAtom = atom(null);
walletHealthAtom.debugLabel = 'walletHealthAtom';

export const utxoClassificationsAtom = atom(null);
utxoClassificationsAtom.debugLabel = 'utxoClassificationsAtom';

export const securityThreatsAtom = atom(null);
securityThreatsAtom.debugLabel = 'securityThreatsAtom';

export const coinSelectionStrategyAtom = atom('efficient');
coinSelectionStrategyAtom.debugLabel = 'coinSelectionStrategyAtom';

// Saved mnemonic atom with localStorage persistence for wallet restoration
const getInitialMnemonic = () => {
  return loadMnemonic();
};

export const savedMnemonicAtom = atom(getInitialMnemonic());
savedMnemonicAtom.debugLabel = 'savedMnemonicAtom';

// Mnemonic setter atom that also persists to localStorage
export const mnemonicSetterAtom = atom(null, (get, set, newMnemonic) => {
  set(savedMnemonicAtom, newMnemonic);
  saveMnemonic(newMnemonic);
});
mnemonicSetterAtom.debugLabel = 'mnemonicSetterAtom';
