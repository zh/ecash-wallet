import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { walletAtom, priceAtom } from '../atoms';

const useXecPrice = (refreshInterval = 300000) => { // 5 minutes default
  const [wallet] = useAtom(walletAtom);
  const [price, setPrice] = useAtom(priceAtom);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch XEC price from external APIs
  const fetchPrice = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try CoinGecko API first
      let xecUsdPrice = 0;

      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ecash&vs_currencies=usd', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          xecUsdPrice = data?.ecash?.usd || 0;
        }
      } catch (apiError) {
        console.warn('CoinGecko API failed, trying fallback:', apiError.message);

        // Fallback to wallet's getXecUsd method (placeholder)
        if (wallet) {
          try {
            xecUsdPrice = await wallet.getXecUsd();
          } catch (walletError) {
            console.warn('Wallet price method failed:', walletError.message);
          }
        }
      }

      setPrice(xecUsdPrice || 0);
    } catch (error) {
      console.error('Failed to fetch XEC price:', error);
      setError(error.message);
      setPrice(0); // Reset to 0 on error
    } finally {
      setLoading(false);
    }
  }, [wallet, setPrice]);

  useEffect(() => {
    // Always fetch price, regardless of wallet connection status
    fetchPrice();

    // Set up interval for periodic price updates
    const interval = setInterval(fetchPrice, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrice, refreshInterval]);

  // Manual refresh function
  const refreshPrice = useCallback(() => {
    fetchPrice();
  }, [fetchPrice]);

  return {
    price,
    loading,
    error,
    refreshPrice
  };
};

export default useXecPrice;