import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAtom } from 'jotai';
import {
  walletAtom,
  walletConnectedAtom,
  securityThreatsAtom
} from '../atoms';
import { handleError, safeAsyncOperation } from '../utils/errorHandler';
import './securitywarnings.css';

const SecurityWarnings = ({
  showInline = true,
  showOnlyHighPriority = false,
  compact = false
}) => {
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [securityThreats, setSecurityThreats] = useAtom(securityThreatsAtom);

  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const [lastCheck, setLastCheck] = useState(0);

  // Check for security threats
  const checkSecurityThreats = useCallback(async () => {
    if (!wallet || !walletConnected) {
      setSecurityThreats(null);
      return;
    }

    try {
      setLoading(true);

      const threats = await safeAsyncOperation(
        async () => {
          await wallet.initialize();

          // Check if security analysis is available
          if (!wallet.utxos || !wallet.utxos.detectSecurityThreats) {
            return { available: false, message: 'Security analysis not available' };
          }

          const analysis = wallet.utxos.detectSecurityThreats(wallet.walletInfo.xecAddress);

          // Also check for token-related risks
          let tokenRisks = {};
          const utxos = wallet.utxos.utxoStore.xecUtxos || [];

          let pureXecCount = 0;
          let tokenUtxoCount = 0;
          let dustCount = 0;
          let suspiciousCount = 0;

          utxos.forEach(utxo => {
            const value = (utxo.value || utxo.sats || 0) / 100;

            if (utxo.token && utxo.token.tokenId) {
              tokenUtxoCount++;
            } else {
              pureXecCount++;
              if (value < 5.46) dustCount++;
              if (value < 1) suspiciousCount++;
            }
          });

          // Token burn risk analysis
          if (tokenUtxoCount > 0 && pureXecCount === 0) {
            tokenRisks.allTokenUtxos = {
              detected: true,
              severity: 'high',
              message: 'All UTXOs contain tokens - no pure XEC available for transactions',
              recommendation: 'Receive pure XEC to avoid accidentally burning tokens'
            };
          } else if (tokenUtxoCount > 0 && pureXecCount < 3) {
            tokenRisks.lowPureXec = {
              detected: true,
              severity: 'medium',
              message: 'Very few pure XEC UTXOs available',
              recommendation: 'Consider receiving more pure XEC for safer transactions'
            };
          }

          // Dust attack risk
          if (dustCount > 10) {
            tokenRisks.dustAttack = {
              detected: true,
              severity: dustCount > 50 ? 'high' : 'medium',
              message: `${dustCount} dust UTXOs detected - possible dust attack`,
              recommendation: 'Use security strategy when sending to avoid dust'
            };
          }

          return {
            available: true,
            ...analysis,
            tokenRisks,
            statistics: {
              totalUtxos: utxos.length,
              pureXecCount,
              tokenUtxoCount,
              dustCount,
              suspiciousCount
            }
          };
        },
        'security_check'
      );

      setSecurityThreats(threats);
      setLastCheck(Date.now());

    } catch (error) {
      console.error('Security check failed:', error);
      handleError(error, 'security_check');
    } finally {
      setLoading(false);
    }
  }, [wallet, walletConnected, setSecurityThreats]);

  // Auto-check security when wallet connects and periodically
  useEffect(() => {
    if (walletConnected) {
      checkSecurityThreats();

      // Check every 5 minutes
      const interval = setInterval(() => {
        if (Date.now() - lastCheck > 300000) { // 5 minutes
          checkSecurityThreats();
        }
      }, 60000); // Check every minute if it's time

      return () => clearInterval(interval);
    } else {
      setSecurityThreats(null);
      setDismissed(new Set());
    }
  }, [walletConnected, lastCheck, checkSecurityThreats, setSecurityThreats]);

  const dismissWarning = (warningId) => {
    setDismissed(new Set([...dismissed, warningId]));
  };

  const getWarnings = () => {
    if (!securityThreats || !securityThreats.available) {
      return [];
    }

    const warnings = [];

    // Dust attack warnings
    if (securityThreats.dustAttack && securityThreats.dustAttack.detected) {
      const confidence = securityThreats.dustAttack.confidence || 0;
      if (confidence > 0.7) {
        warnings.push({
          id: 'dust-attack-high',
          severity: 'high',
          type: 'dust-attack',
          title: 'High Risk: Dust Attack Detected',
          message: `Strong indicators of dust attack (${(confidence * 100).toFixed(0)}% confidence)`,
          recommendation: 'Use security strategy for all transactions and consider wallet consolidation',
          dismissible: false
        });
      } else if (confidence > 0.3) {
        warnings.push({
          id: 'dust-attack-medium',
          severity: 'medium',
          type: 'dust-attack',
          title: 'Possible Dust Attack',
          message: `Some dust attack indicators detected (${(confidence * 100).toFixed(0)}% confidence)`,
          recommendation: 'Monitor transactions carefully and use security strategy when sending',
          dismissible: true
        });
      }
    }

    // Token-related risks
    if (securityThreats.tokenRisks) {
      Object.entries(securityThreats.tokenRisks).forEach(([riskType, risk]) => {
        if (risk.detected) {
          warnings.push({
            id: `token-risk-${riskType}`,
            severity: risk.severity,
            type: 'token-risk',
            title: `Token Safety: ${risk.message}`,
            message: risk.message,
            recommendation: risk.recommendation,
            dismissible: risk.severity !== 'high'
          });
        }
      });
    }

    // Filter based on priority and dismissal status
    return warnings.filter(warning => {
      if (dismissed.has(warning.id)) return false;
      if (showOnlyHighPriority && warning.severity !== 'high') return false;
      return true;
    });
  };

  const warnings = getWarnings();

  if (!walletConnected || warnings.length === 0) {
    return null;
  }

  if (compact) {
    const highPriorityCount = warnings.filter(w => w.severity === 'high').length;
    const mediumPriorityCount = warnings.filter(w => w.severity === 'medium').length;

    if (highPriorityCount === 0 && mediumPriorityCount === 0) return null;

    return (
      <div className="security-warnings-compact">
        {highPriorityCount > 0 && (
          <div className="security-indicator high">
            ⚠️ {highPriorityCount} security alert{highPriorityCount !== 1 ? 's' : ''}
          </div>
        )}
        {mediumPriorityCount > 0 && (
          <div className="security-indicator medium">
            ⚠️ {mediumPriorityCount} security notice{mediumPriorityCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  if (!showInline) {
    return (
      <div className="security-warnings-modal">
        <div className="security-modal-content">
          <div className="security-modal-header">
            <h3>Security Alerts</h3>
          </div>
          <div className="security-modal-body">
            {warnings.map(warning => (
              <div key={warning.id} className={`security-warning ${warning.severity}`}>
                <div className="warning-header">
                  <span className="warning-icon">
                    {warning.severity === 'high' ? '🚨' : '⚠️'}
                  </span>
                  <h4>{warning.title}</h4>
                  {warning.dismissible && (
                    <button
                      className="dismiss-button"
                      onClick={() => dismissWarning(warning.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
                <p className="warning-message">{warning.message}</p>
                {warning.recommendation && (
                  <p className="warning-recommendation">
                    <strong>Recommendation:</strong> {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="security-warnings-inline">
      {warnings.map(warning => (
        <div key={warning.id} className={`security-warning ${warning.severity}`}>
          <div className="warning-header">
            <span className="warning-icon">
              {warning.severity === 'high' ? '🚨' : '⚠️'}
            </span>
            <h4>{warning.title}</h4>
            {warning.dismissible && (
              <button
                className="dismiss-button"
                onClick={() => dismissWarning(warning.id)}
              >
                ×
              </button>
            )}
          </div>
          <p className="warning-message">{warning.message}</p>
          {warning.recommendation && (
            <p className="warning-recommendation">
              <strong>Recommendation:</strong> {warning.recommendation}
            </p>
          )}
        </div>
      ))}

      {loading && (
        <div className="security-checking">
          <span>🔍 Checking for security threats...</span>
        </div>
      )}
    </div>
  );
};

SecurityWarnings.propTypes = {
  showInline: PropTypes.bool,
  showOnlyHighPriority: PropTypes.bool,
  compact: PropTypes.bool,
};

export default SecurityWarnings;