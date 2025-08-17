import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAtom } from 'jotai';
import { walletConnectedAtom } from '../../atoms';
import { useBalance } from '../../hooks';
import NetworkStatus from '../NetworkStatus';
import ThemeToggle from '../ThemeToggle';

const TopBar = ({ title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [walletConnected] = useAtom(walletConnectedAtom);
  const { loading, refreshBalance } = useBalance();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isHomePage = location.pathname === '/';
  const showBackButton = !isHomePage;
  const showRefreshLink = isHomePage && walletConnected;

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleRefreshClick = async () => {
    if (!refreshBalance || loading || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await refreshBalance();
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      // Reset refreshing state after a short delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  };

  return (
    <div className="top-bar">
      <div className="top-bar-content">
        {showBackButton && (
          <button
            onClick={handleBackClick}
            className="back-button"
            aria-label="Go back"
          >
            Back
          </button>
        )}
        {showRefreshLink && (
          <button
            onClick={handleRefreshClick}
            className="back-button"
            aria-label="Refresh balance"
            disabled={loading || isRefreshing}
          >
            {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
        <h1 className="page-title">{title}</h1>
        <div className="top-bar-spacer">
          <ThemeToggle compact={true} />
          <NetworkStatus compact={true} />
        </div>
      </div>
    </div>
  );
};

TopBar.propTypes = {
  title: PropTypes.string.isRequired
};

export default TopBar;