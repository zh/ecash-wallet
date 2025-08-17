import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const NetworkStatus = ({ compact = false, showDetails = false }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastOnlineTime, setLastOnlineTime] = useState(Date.now());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(Date.now());
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getTimeSinceOnline = () => {
    const now = Date.now();
    const diff = now - lastOnlineTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const statusDotColor = isOnline ? '#4caf50' : '#f44336'; // Green when online, red when offline

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: compact ? '6px' : '8px',
      padding: compact ? '2px 4px' : '4px 8px',
      fontSize: compact ? '0.7em' : '0.8em',
      color: 'var(--text-secondary)',
      backgroundColor: compact ? 'transparent' : 'var(--bg-overlay)',
      borderRadius: compact ? '2px' : '4px',
      margin: compact ? '0' : '4px 0'
    }}>
      {/* Status dot - green/red */}
      <div style={{
        width: compact ? '8px' : '10px',
        height: compact ? '8px' : '10px',
        borderRadius: '50%',
        backgroundColor: statusDotColor,
        flexShrink: 0
      }} />

      {!compact && (
        <span>
          {isOnline ? 'Online' : 'Offline'}
          {showDetails && !isOnline && (
            <span style={{ marginLeft: '4px', color: 'var(--text-tertiary)' }}>
              (Last online: {getTimeSinceOnline()})
            </span>
          )}
        </span>
      )}
    </div>
  );
};

NetworkStatus.propTypes = {
  compact: PropTypes.bool,
  showDetails: PropTypes.bool
};

export default NetworkStatus;