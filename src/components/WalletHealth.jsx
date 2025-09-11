import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import {
  walletAtom,
  walletConnectedAtom,
  walletHealthAtom,
  utxoClassificationsAtom,
  securityThreatsAtom,
  balanceBreakdownAtom
} from '../atoms';
import { handleError, safeAsyncOperation } from '../utils/errorHandler';
import './wallethealth.css';

const WalletHealth = () => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [walletHealth, setWalletHealth] = useAtom(walletHealthAtom);
  const [utxoClassifications, setUtxoClassifications] = useAtom(utxoClassificationsAtom);
  const [securityThreats, setSecurityThreats] = useAtom(securityThreatsAtom);
  const [balanceBreakdown] = useAtom(balanceBreakdownAtom);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch comprehensive wallet health data
  const fetchWalletHealth = useCallback(async () => {
    if (!wallet || !walletConnected) {
      setWalletHealth(null);
      setUtxoClassifications(null);
      setSecurityThreats(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const healthData = await safeAsyncOperation(
        async () => {
          // Ensure wallet is fully initialized and wait for UTXOs
          await wallet.initialize();

          // Wait a bit for UTXOs to load
          let retryCount = 0;
          const maxRetries = 5;
          while ((!wallet.utxos || !wallet.utxos.utxoStore || !wallet.utxos.utxoStore.xecUtxos) && retryCount < maxRetries) {
            console.log(`Waiting for UTXO data... attempt ${retryCount + 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retryCount++;
          }

          const utxos = wallet.utxos?.utxoStore?.xecUtxos || [];
          console.log(`UTXO health analysis - Found ${utxos.length} UTXOs`);

          if (utxos.length === 0) {
            console.warn('No UTXOs found - wallet may be empty or still loading');
          }

          // Check if analytics are available - improved detection
          const analyticsAvailable = wallet.utxos &&
            (wallet.utxos.analyticsEnabled ||
             wallet.utxos.getUtxoClassifications ||
             wallet.utxos.detectSecurityThreats ||
             wallet.utxos.getWalletHealthReport);

          if (!analyticsAvailable) {
            console.warn('Analytics functions not available in wallet instance');
            return {
              hasAnalytics: false,
              message: 'Analytics not available - functions not found in wallet instance'
            };
          }

          console.log('Analytics detection:', {
            analyticsEnabled: wallet.utxos.analyticsEnabled,
            hasClassifications: !!wallet.utxos.getUtxoClassifications,
            hasThreats: !!wallet.utxos.detectSecurityThreats,
            hasHealthReport: !!wallet.utxos.getWalletHealthReport
          });

          let healthMetrics = {};
          let classifications = {};
          let threats = {};

          try {
            // Get UTXO classifications with error handling
            if (wallet.utxos.getUtxoClassifications) {
              try {
                console.log('Attempting to get UTXO classifications...');
                classifications = await wallet.utxos.getUtxoClassifications();
                console.log('Classifications result:', classifications);
              } catch (classError) {
                console.warn('UTXO classification failed:', classError.message);
                classifications = { error: classError.message };
              }
            }

            // Get security threat analysis with error handling
            if (wallet.utxos.detectSecurityThreats) {
              try {
                console.log('Attempting security threat detection...');
                threats = await wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress);
                console.log('Threats result:', threats);
              } catch (threatError) {
                console.warn('Security threat detection failed:', threatError.message);
                threats = { error: threatError.message };
              }
            }

            // Get health monitoring data with error handling
            if (wallet.utxos.getWalletHealthReport) {
              try {
                console.log('Attempting wallet health report...');
                healthMetrics = await wallet.utxos.getWalletHealthReport();
                console.log('Health metrics result:', healthMetrics);
              } catch (healthError) {
                console.warn('Health report failed:', healthError.message);
                healthMetrics = { error: healthError.message };
              }
            }

            // Get UTXO statistics - use same calculation as balance hook for consistency
            const utxos = wallet.utxos.utxoStore.xecUtxos || [];

            let totalUtxos = utxos.length;
            let pureXecUtxos = 0;
            let tokenUtxos = 0;
            let dustUtxos = 0;
            let largestUtxo = 0;
            let smallestUtxo = Infinity;

            // Calculate UTXO metrics consistently with balance calculation
            utxos.forEach(utxo => {
              const value = (utxo.value || utxo.sats || 0) / 100; // Convert to XEC

              if (value > largestUtxo) largestUtxo = value;
              if (value < smallestUtxo) smallestUtxo = value;

              if (utxo.token && utxo.token.tokenId) {
                tokenUtxos++;
              } else {
                pureXecUtxos++;
                if (value < 10) dustUtxos++; // Less than 10 XEC considered dust
              }
            });

            if (smallestUtxo === Infinity) smallestUtxo = 0;

            // Use balance breakdown from atoms for consistent values
            const { spendableBalance, totalBalance, tokenDustValue } = balanceBreakdown || {
              spendableBalance: 0,
              totalBalance: 0,
              tokenDustValue: 0
            };

            return {
              hasAnalytics: true,
              health: healthMetrics,
              classifications,
              threats,
              statistics: {
                totalUtxos,
                pureXecUtxos,
                tokenUtxos,
                dustUtxos,
                totalValue: totalBalance, // Use consistent total balance
                spendableValue: spendableBalance, // Add spendable balance
                tokenDustValue: tokenDustValue, // Add token dust value
                largestUtxo,
                smallestUtxo,
                averageUtxoSize: totalUtxos > 0 ? totalBalance / totalUtxos : 0,
                dustPercentage: totalUtxos > 0 ? (dustUtxos / totalUtxos) * 100 : 0
              }
            };
          } catch (analyticsError) {
            console.warn('Error getting detailed analytics:', analyticsError);

            // Fallback: basic UTXO analysis without analytics
            const utxos = wallet.utxos.utxoStore.xecUtxos || [];

            // Use consistent balance values from atoms even in fallback mode
            const { spendableBalance, totalBalance, tokenDustValue } = balanceBreakdown || {
              spendableBalance: 0,
              totalBalance: 0,
              tokenDustValue: 0
            };

            return {
              hasAnalytics: false,
              fallbackAnalysis: true,
              message: 'Using basic analysis - full analytics not available',
              statistics: {
                totalUtxos: utxos.length,
                pureXecUtxos: utxos.filter(u => !u.token || !u.token.tokenId).length,
                tokenUtxos: utxos.filter(u => u.token && u.token.tokenId).length,
                totalValue: totalBalance, // Use consistent total balance
                spendableValue: spendableBalance, // Add spendable balance
                tokenDustValue: tokenDustValue, // Add token dust value
              }
            };
          }
        },
        'fetch_wallet_health'
      );

      setWalletHealth(healthData);

      if (healthData.classifications) {
        setUtxoClassifications(healthData.classifications);
      }

      if (healthData.threats) {
        setSecurityThreats(healthData.threats);
      }

    } catch (error) {
      console.error('Failed to fetch wallet health:', error);
      const handledError = handleError(error, 'wallet_health');
      setError(handledError.message);
      setWalletHealth(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, walletConnected, setWalletHealth, setUtxoClassifications, setSecurityThreats, balanceBreakdown]);

  // Auto-fetch health data when wallet connects
  useEffect(() => {
    if (walletConnected) {
      fetchWalletHealth();
    } else {
      setWalletHealth(null);
      setUtxoClassifications(null);
      setSecurityThreats(null);
      setError(null);
    }
  }, [walletConnected, fetchWalletHealth, setWalletHealth, setUtxoClassifications, setSecurityThreats]);

  const getHealthScore = (health) => {
    if (!health || !health.statistics) return { score: 0, label: 'Unknown' };

    const stats = health.statistics;
    let score = 100;

    // Penalize high dust percentage
    if (stats.dustPercentage > 30) score -= 20;
    else if (stats.dustPercentage > 15) score -= 10;

    // Penalize too many UTXOs (fragmentation)
    if (stats.totalUtxos > 100) score -= 15;
    else if (stats.totalUtxos > 50) score -= 8;

    // Bonus for having both XEC and tokens (diversified)
    if (stats.tokenUtxos > 0 && stats.pureXecUtxos > 0) score += 5;

    score = Math.max(0, Math.min(100, score));

    let label = 'Poor';
    if (score >= 80) label = 'Excellent';
    else if (score >= 65) label = 'Good';
    else if (score >= 50) label = 'Fair';

    return { score, label };
  };

  const renderOverview = () => {
    if (!walletHealth) return null;

    const { score, label } = getHealthScore(walletHealth);
    const stats = walletHealth.statistics || {};

    return (
      <div className="health-overview">
        <div className="health-score">
          <div className={`score-circle ${label.toLowerCase()}`}>
            <span className="score-number">{score}</span>
            <span className="score-label">{label}</span>
          </div>
        </div>

        <div className="health-stats">
          <div className="stat-group">
            <h4>UTXO Overview</h4>
            <div className="stat-item">
              <span className="stat-label">Total UTXOs:</span>
              <span className="stat-value">{stats.totalUtxos || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Pure XEC UTXOs:</span>
              <span className="stat-value">{stats.pureXecUtxos || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Token UTXOs:</span>
              <span className="stat-value">{stats.tokenUtxos || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Dust UTXOs:</span>
              <span className="stat-value dust">{stats.dustUtxos || 0}</span>
            </div>
          </div>

          <div className="stat-group">
            <h4>Value Distribution</h4>
            <div className="stat-item">
              <span className="stat-label">Spendable XEC:</span>
              <span className="stat-value">{stats.spendableValue?.toFixed(2) || '0.00'} XEC</span>
            </div>
            {stats.tokenDustValue > 0 && (
              <div className="stat-item">
                <span className="stat-label">Token Dust:</span>
                <span className="stat-value token-dust">{stats.tokenDustValue?.toFixed(2) || '0.00'} XEC</span>
              </div>
            )}
            <div className="stat-item">
              <span className="stat-label">Total Value:</span>
              <span className="stat-value">{stats.totalValue?.toFixed(2) || '0.00'} XEC</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Largest UTXO:</span>
              <span className="stat-value">{stats.largestUtxo?.toFixed(2) || '0.00'} XEC</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average UTXO:</span>
              <span className="stat-value">{stats.averageUtxoSize?.toFixed(2) || '0.00'} XEC</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Dust Percentage:</span>
              <span className="stat-value dust">{stats.dustPercentage?.toFixed(1) || '0.0'}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSecurity = () => {
    if (!securityThreats || !securityThreats.available) {
      return (
        <div className="security-analysis">
          <h4>Security Analysis</h4>

          {/* Fallback Security Recommendations */}
          <div className="fallback-security">
            <div className="security-notice">
              <p>⚠️ Advanced security analysis requires analytics features.</p>
              <p>Showing basic security recommendations:</p>
            </div>

            <div className="basic-security-checks">
              <h5>General Security Recommendations</h5>

              <div className="recommendation safe">
                <p>✅ <strong>Backup your mnemonic:</strong> Keep your 12-word seed phrase secure and offline.</p>
              </div>

              <div className="recommendation safe">
                <p>✅ <strong>Verify addresses:</strong> Always double-check recipient addresses before sending.</p>
              </div>

              <div className="recommendation info">
                <p>ℹ️ <strong>Use transaction strategies:</strong> Select appropriate strategies (security/privacy/efficient) when sending.</p>
              </div>

              <div className="recommendation info">
                <p>ℹ️ <strong>Monitor for dust:</strong> Small UTXOs may indicate dust attacks.</p>
              </div>

              {walletHealth?.statistics && (
                <div className="basic-utxo-analysis">
                  <h6>Basic UTXO Analysis</h6>
                  {walletHealth.statistics.totalUtxos > 50 && (
                    <div className="recommendation warning">
                      <p>⚠️ High UTXO count ({walletHealth.statistics.totalUtxos}) - consider consolidation for better performance.</p>
                    </div>
                  )}
                  {walletHealth.statistics.tokenUtxos > 0 && (
                    <div className="recommendation safe">
                      <p>✅ Token UTXOs detected ({walletHealth.statistics.tokenUtxos}) - these are protected from accidental XEC spending.</p>
                    </div>
                  )}
                  {walletHealth.statistics.dustUtxos > 5 && (
                    <div className="recommendation warning">
                      <p>⚠️ Multiple dust UTXOs detected ({walletHealth.statistics.dustUtxos}) - potential dust attack indicators.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="enable-analytics">
                <p><strong>For advanced security analysis:</strong> Disconnect and reconnect your wallet to enable analytics features.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="security-analysis">
        <h4>Security Threat Analysis</h4>

        {securityThreats.dustAttack && (
          <div className={`threat-item ${securityThreats.dustAttack.detected ? 'warning' : 'safe'}`}>
            <h5>Dust Attack Detection</h5>
            <p>Status: {securityThreats.dustAttack.detected ? 'DETECTED' : 'None detected'}</p>
            {securityThreats.dustAttack.confidence && (
              <p>Confidence: {(securityThreats.dustAttack.confidence * 100).toFixed(1)}%</p>
            )}
            {securityThreats.dustAttack.details && (
              <p>Details: {securityThreats.dustAttack.details}</p>
            )}
          </div>
        )}

        <div className="recommendations">
          <h5>Recommendations</h5>
          {walletHealth?.statistics?.dustPercentage > 20 && (
            <div className="recommendation warning">
              <p>⚠️ High dust ratio detected. Consider consolidating small UTXOs.</p>
            </div>
          )}
          {walletHealth?.statistics?.totalUtxos > 50 && (
            <div className="recommendation info">
              <p>ℹ️ Many UTXOs detected. Consolidation may improve transaction efficiency.</p>
            </div>
          )}
          {walletHealth?.statistics?.tokenUtxos > 10 && (
            <div className="recommendation safe">
              <p>✅ Token diversity detected. UTXOs are protected from accidental XEC spending.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderClassifications = () => {
    // Check if there's an error in classifications
    if (utxoClassifications && utxoClassifications.error) {
      return (
        <div className="utxo-classifications">
          <h4>UTXO Classifications</h4>
          <div className="classification-error">
            <p>⚠️ Classification analysis failed: {utxoClassifications.error}</p>
            <p>This may be due to missing analytics dependencies or browser compatibility issues.</p>
          </div>
        </div>
      );
    }

    if (!utxoClassifications || !utxoClassifications.classifications) {
      return (
        <div className="utxo-classifications">
          <h4>UTXO Classifications</h4>

          {/* Show basic classification based on balance data if advanced analytics aren't available */}
          {balanceBreakdown && balanceBreakdown.tokenUtxos > 0 ? (
            <div className="basic-classifications">
              <div className="classification-notice">
                <p>Showing basic UTXO analysis</p>
              </div>

              <div className="basic-classification-group">
                <h5>Pure XEC UTXOs ({balanceBreakdown.pureXecUtxos})</h5>
                <p>Value: {balanceBreakdown.spendableBalance.toFixed(2)} XEC</p>
                <p>These UTXOs can be used for transaction fees and XEC transfers.</p>
              </div>

              {balanceBreakdown.tokenUtxos > 0 && (
                <div className="basic-classification-group">
                  <h5>Token UTXOs ({balanceBreakdown.tokenUtxos})</h5>
                  <p>XEC Value: {balanceBreakdown.tokenDustValue.toFixed(2)} XEC</p>
                  <p>These UTXOs contain tokens and minimal XEC for transfers.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="classification-empty">
              <p>No UTXO classification data available</p>
              <p>Connect a wallet with UTXOs to see classification analysis.</p>
            </div>
          )}
        </div>
      );
    }

    const classifications = utxoClassifications.classifications;

    return (
      <div className="utxo-classifications">
        <h4>UTXO Classifications</h4>

        {Object.entries(classifications).map(([type, utxos]) => (
          <div key={type} className="classification-group">
            <h5>{type} ({utxos.length})</h5>
            {utxos.slice(0, 5).map((utxo, index) => (
              <div key={index} className="utxo-item">
                <span className="utxo-value">{((utxo.value || utxo.sats || 0) / 100).toFixed(2)} XEC</span>
                <span className="utxo-hash">{utxo.tx_hash?.substring(0, 8)}...</span>
                {utxo.token && <span className="utxo-token">Token: {utxo.token.tokenId.substring(0, 8)}...</span>}
              </div>
            ))}
            {utxos.length > 5 && (
              <p className="more-items">... and {utxos.length - 5} more</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!walletConnected) {
    return (
      <div className="wallet-health-container">
        <div className="health-header">
          <h2>Wallet Health</h2>
          <p>Connect your wallet to view health analysis</p>
        </div>
        <div className="health-empty">
          <p>Please connect your wallet to analyze its health and security.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wallet-health-container">
        <div className="health-header">
          <h2>Wallet Health</h2>
          <p>Analyzing wallet health...</p>
        </div>
        <div className="health-loading">
          <div className="spinner"></div>
          <p>Scanning UTXOs and analyzing security...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-health-container">
        <div className="health-header">
          <h2>Wallet Health</h2>
          <p>Error analyzing wallet</p>
        </div>
        <div className="health-error">
          <p>Failed to analyze wallet health: {error}</p>
          <button
            onClick={fetchWalletHealth}
            className="retry-button"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!walletHealth) {
    return (
      <div className="wallet-health-container">
        <div className="health-header">
          <h2>Wallet Health</h2>
          <p>No health data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-health-container">
      <div className="health-header">
        <h2>Wallet Health Dashboard</h2>
        <div className="health-actions">
          <button
            onClick={fetchWalletHealth}
            className="refresh-button"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {!walletHealth.hasAnalytics && (
        <div className="analytics-notice">
          <p>⚠️ {walletHealth.message}</p>
          {walletHealth.fallbackAnalysis && (
            <p>Showing basic UTXO statistics only.</p>
          )}
          <div className="analytics-instructions">
            <p><strong>To enable full analytics features:</strong></p>
            <p>1. Go to the Home page and click &ldquo;Disconnect&rdquo;</p>
            <p>2. Reconnect your wallet with the same mnemonic</p>
            <p>3. Your wallet will be created with analytics support</p>
          </div>
        </div>
      )}

      <div className="health-tabs">
        <button
          className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${selectedTab === 'security' ? 'active' : ''}`}
          onClick={() => setSelectedTab('security')}
        >
          Security
        </button>
        {/* Always show Classifications tab - it will show basic info if analytics unavailable */}
        <button
          className={`tab-button ${selectedTab === 'classifications' ? 'active' : ''}`}
          onClick={() => setSelectedTab('classifications')}
        >
          UTXO Classifications
        </button>
      </div>

      <div className="health-content">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'security' && renderSecurity()}
        {selectedTab === 'classifications' && renderClassifications()}
      </div>
    </div>
  );
};

export default WalletHealth;
