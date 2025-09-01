import { useState, useEffect, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  walletAtom,
  walletConnectedAtom,
  eTokensAtom,
  notificationAtom,
  busyAtom
} from '../atoms';
import { handleError, safeAsyncOperation } from '../utils/errorHandler';
import TokenCard from './TokenCard';
import '../styles/tokenslist.css';

const TokensList = () => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [eTokens, setETokens] = useAtom(eTokensAtom);
  const setNotification = useSetAtom(notificationAtom);
  const [busy] = useAtom(busyAtom);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  // Fetch tokens from wallet
  const fetchTokens = useCallback(async () => {
    if (!wallet || !walletConnected) {
      setETokens([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the correct minimal-xec-wallet API - listETokens()
      const tokens = await safeAsyncOperation(
        async () => {
          // Ensure wallet is fully ready (example pattern)
          if (!wallet.isInitialized) {
            await wallet.walletInfoPromise; // Wait for wallet info first
            await wallet.initialize(); // Then initialize UTXOs
          }

          // Use the official listETokens API from examples
          const tokenList = await wallet.listETokens();

          return tokenList;
        },
        'fetch_tokens'
      );

      // Process tokens from listETokens() - they already have all metadata
      const enhancedTokens = tokens.map((token) => {

        // Use token.balance.display which is already formatted correctly
        const balanceValue = token.balance?.display || 0;

        return {
          id: token.tokenId,
          tokenId: token.tokenId,
          balance: balanceValue,
          name: token.name || `Token ${token.tokenId.slice(0, 8).toUpperCase()}`,
          symbol: token.ticker || token.tokenId.slice(0, 8).toUpperCase(),
          decimals: token.decimals || 0,
          totalSupply: null, // Not provided by listETokens
          documentUri: token.url || null,
          type: token.protocol || 'SLP',
          protocol: token.protocol || 'SLP',
          utxoCount: token.utxoCount || 0,
          displayBalance: balanceValue
        };
      });

      setETokens(enhancedTokens);

    } catch (error) {
      console.error('Failed to fetch tokens:', error);
      const handledError = handleError(error, 'fetch_tokens');
      setError(handledError.message);
      setNotification({ type: 'error', message: handledError.message });
      setETokens([]);
    } finally {
      setLoading(false);
    }
  }, [wallet, walletConnected, setETokens, setNotification]);

  // Auto-fetch tokens when wallet connects
  useEffect(() => {
    if (walletConnected) {
      fetchTokens();
    } else {
      setETokens([]);
      setError(null);
    }
  }, [walletConnected, fetchTokens, setETokens]);

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTokens();
    setRefreshing(false);
    setNotification({
      type: 'success',
      message: 'Token list refreshed successfully'
    });
  };


  if (!walletConnected) {
    return (
      <div className="tokens-list-container">
        <div className="tokens-header">
          <h2>My eTokens</h2>
          <p className="tokens-description">
            Connect your wallet to view your eToken collection
          </p>
        </div>
        <div className="tokens-empty">
          <p>Please connect your wallet to view tokens</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tokens-list-container">
        <div className="tokens-header">
          <h2>My eTokens</h2>
          <p className="tokens-description">Loading your token collection...</p>
        </div>
        <div className="tokens-loading">
          <div className="spinner"></div>
          <p>Fetching tokens from blockchain...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tokens-list-container">
        <div className="tokens-header">
          <h2>My eTokens</h2>
          <p className="tokens-description">Error loading tokens</p>
        </div>
        <div className="tokens-error">
          <p>Failed to load tokens: {error}</p>
          <button
            onClick={handleRefresh}
            className="retry-button"
            disabled={refreshing}
          >
            {refreshing ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Render the zoomed-in TokenCard if a token is selected
  if (selectedToken) {
    return (
      <div className="zoomed-token-wrapper">
        <TokenCard
          token={selectedToken}
          onZoomOut={() => setSelectedToken(null)} // Handler to exit zoom mode
          zoomed
        />
      </div>
    );
  }

  return (
    <div className="tokens-list-wrapper">
      <div className="tokens-header">
        <h2>My eTokens</h2>
        <p className="tokens-description">
          Your SLP and ALP token collection
        </p>
        <button
          onClick={handleRefresh}
          className="refresh-button"
          disabled={refreshing || busy}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && <div className="tokens-loading">
        <div className="spinner"></div>
        <p>Fetching tokens from blockchain...</p>
      </div>}

      {error && <div className="tokens-error">
        <p>Failed to load tokens: {error}</p>
        <button
          onClick={handleRefresh}
          className="retry-button"
          disabled={refreshing}
        >
          {refreshing ? 'Retrying...' : 'Retry'}
        </button>
      </div>}

      {!loading && !error && eTokens.length > 0 && (
        <div className="token-list">
          {eTokens.map((token) => (
            <TokenCard
              key={token.tokenId}
              token={token}
              onClick={() => setSelectedToken(token)}
            />
          ))}
        </div>
      )}

      {!loading && !error && eTokens.length === 0 && (
        <div className="tokens-empty">
          <h3>No tokens found</h3>
          <p>You don&apos;t have any eTokens yet.</p>
          <p>eTokens (SLP/ALP) will appear here when you receive them.</p>
        </div>
      )}
    </div>
  );
};

export default TokensList;
