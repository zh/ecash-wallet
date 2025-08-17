import { atom } from 'jotai';

// XEC wallet options - uses Chronik (no server selection needed)
export const optionsAtom = atom({
  // minimal-xec-wallet handles Chronik connection internally
  noUpdate: true,
});
optionsAtom.debugLabel = 'optionsAtom';

export const mnemonicAtom = atom('');
mnemonicAtom.debugLabel = 'mnemonicAtom';

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
export const balanceAtom = atom(0);
balanceAtom.debugLabel = 'balanceAtom';

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
