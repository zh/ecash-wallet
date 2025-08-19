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
    // Always set loading true first, even if we return early
    setLoading(true);
    setError(null);

    if (!wallet || !walletConnected) {
      setBalance(0); // Reset to 0 if wallet is not available
      setLoading(false);
      return;
    }

    try {
      // Defensive check: ensure wallet is still valid before calling API
      if (!wallet.getDetailedBalance || typeof wallet.getDetailedBalance !== 'function') {
        throw new Error('Wallet getDetailedBalance method not available');
      }

      // Use CLI's working pattern - getDetailedBalance and proper UTXO filtering
      // First ensure wallet UTXOs are fresh
      await wallet.initialize();

      // Get detailed balance like CLI does (this works reliably)
      const balanceData = await wallet.getDetailedBalance();
      let spendableBalance = balanceData.total; // Start with total balance

      // Calculate spendable balance by subtracting eToken dust (CLI pattern)
      if (wallet.utxos && wallet.utxos.utxoStore && wallet.utxos.utxoStore.xecUtxos) {
        const utxos = wallet.utxos.utxoStore.xecUtxos;
        let pureXecTotal = 0;

        // Use exact CLI filtering logic
        for (const utxo of utxos) {
          // Get XEC amount using CLI's method - prefer sats property
          let xecAmount = 0;
          if (utxo.sats !== undefined) {
            const satoshis = parseInt(utxo.sats) || 0;
            xecAmount = satoshis / 100; // Convert from satoshis to XEC
          } else if (utxo.value) {
            const satoshis = parseInt(utxo.value) || 0;
            xecAmount = satoshis / 100; // Convert from satoshis to XEC
          }

          // Use CLI's exact token detection logic
          if (utxo.token && utxo.token.tokenId) {
            // This UTXO is locked with tokens (eToken dust) - skip it
          } else {
            // This is pure XEC UTXO (spendable)
            pureXecTotal += xecAmount;
          }
        }

        // Use the calculated pure XEC total (excludes eToken dust)
        spendableBalance = pureXecTotal;
      }

      const xecBalance = spendableBalance;

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
