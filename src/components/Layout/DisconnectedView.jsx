import LoadScript from '../LoadScript';
import Notification from '../Notification';
import ECashWallet from '../ECashWallet';
import ThemeToggle from '../ThemeToggle';
import { useAtom } from 'jotai';
import { scriptLoadedAtom, scriptErrorAtom } from '../../atoms';
import '../../styles/disconnected.css';

const DisconnectedView = () => {
  const [scriptLoaded] = useAtom(scriptLoadedAtom);
  const [scriptError] = useAtom(scriptErrorAtom);

  return (
    <div className="disconnected-view">
      <LoadScript scriptSrc="/minimal-xec-wallet.min.js" />

      <div className="app-header">
        <div className="app-title">
          eCash Wallet
        </div>
        <ThemeToggle />
      </div>

      <Notification />

      <div className="wallet-setup">
        {scriptError && (
          <div className="error">
            <p>❌ Error loading wallet library</p>
            <div className="error-info">
              {scriptError}
              <br />
              Please check that minimal-xec-wallet.min.js is available in the public folder.
            </div>
          </div>
        )}

        {!scriptLoaded && !scriptError && (
          <div className="loading">
            <p>
              <span className="loading-spinner"></span>
              Loading eCash wallet library...
            </p>
            <div className="loading-info">
              Connecting to eCash blockchain infrastructure via Chronik.
              This may take a few moments on first load.
            </div>
          </div>
        )}

        {scriptLoaded && (
          <ECashWallet />
        )}
      </div>

      <div className="app-footer">
        Powered by <a href="https://chronik.be.cash" target="_blank" rel="noopener noreferrer">Chronik</a>
      </div>
    </div>
  );
};

export default DisconnectedView;