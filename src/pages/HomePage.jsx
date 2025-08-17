import MobileLayout from '../components/Layout/MobileLayout';
import Balance from '../components/Balance';
import Address from '../components/Address';
import { useConnectWallet } from '../hooks';
import { useAtom } from 'jotai';
import { walletConnectedAtom } from '../atoms';
import '../styles/home.css';

const HomePage = () => {
  const { disconnectWallet } = useConnectWallet();
  const [walletConnected] = useAtom(walletConnectedAtom);

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect the wallet?')) {
      disconnectWallet();
    }
  };

  return (
    <MobileLayout title="eCash Wallet">
      <div className="home-content">
        {/* Disconnect button at top */}
        {walletConnected && (
          <div className="wallet-actions-top">
            <button
              onClick={handleDisconnect}
              className="disconnect-button-top"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Address component (QR + address) */}
        {walletConnected && (
          <div className="address-section">
            <Address
              addressFormat={'long'}
              showEToken={false}
              showQR={true}
              showSwitch={true}
            />
          </div>
        )}

        {/* Balance component */}
        <div className="wallet-overview">
          <Balance />
        </div>
      </div>
    </MobileLayout>
  );
};

export default HomePage;