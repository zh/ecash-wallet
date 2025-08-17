import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import {
  walletAtom,
  walletConnectedAtom,
  balanceAtom,
  balanceRefreshTriggerAtom,
} from '../atoms';

const useBalance = (refreshInterval = 10000) => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [balance, setBalance] = useAtom(balanceAtom);
  const [triggerRefresh] = useAtom(balanceRefreshTriggerAtom);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Memoize fetchBalance to avoid creating a new function on each render
  const fetchBalance = useCallback(async () => {
    console.log('fetchBalance called - wallet:', !!wallet, 'connected:', walletConnected);

    // Always set loading true first, even if we return early
    setLoading(true);
    setError(null);

    if (!wallet || !walletConnected) {
      console.log('Early return: wallet not available');
      setBalance(0); // Reset to 0 if wallet is not available
      setLoading(false);
      return;
    }

    try {
      // Defensive check: ensure wallet is still valid before calling API
      if (!wallet.getXecBalance || typeof wallet.getXecBalance !== 'function') {
        throw new Error('Wallet getXecBalance method not available');
      }

      console.log('Calling wallet.getXecBalance()...');
      // Use XEC-specific method - returns balance in XEC units (2 decimal places)
      const xecBalance = await wallet.getXecBalance();
      console.log('Balance received:', xecBalance);

      // Defensive check: ensure wallet is still connected after API call
      if (!wallet || !walletConnected) {
        console.warn('Wallet became disconnected during balance fetch');
        return;
      }

      setBalance(xecBalance || 0); // Update atom with XEC balance

      // Add minimum loading time to make it visible
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('Failed to fetch XEC balance:', error);
      setError(error.message);
      setBalance(0); // Reset to 0 in case of an error

      // Don't disconnect wallet on balance fetch errors - just log and continue
    } finally {
      console.log('Setting loading false');
      setLoading(false);
    }
  }, [wallet, walletConnected, setBalance]);

  useEffect(() => {
    if (walletConnected) {
      fetchBalance(); // Fetch balance when wallet connects
      const interval = setInterval(fetchBalance, refreshInterval); // Refresh every 10 seconds
      return () => clearInterval(interval); // Cleanup interval on unmount or disconnect
    }
  }, [walletConnected, fetchBalance, refreshInterval]);

  // Separate effect for manual refresh trigger
  useEffect(() => {
    if (walletConnected && triggerRefresh > 0) {
      fetchBalance(); // Only call fetchBalance, don't set up new interval
    }
  }, [triggerRefresh, walletConnected, fetchBalance]);

  return { balance, loading, error, refreshBalance: fetchBalance };
};

export default useBalance;
