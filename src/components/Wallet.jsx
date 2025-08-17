import { useConnectWallet } from '../hooks';
import { useAtom } from 'jotai';
import { walletConnectedAtom, mnemonicAtom } from '../atoms';
import '../styles/wallet.css';

const Wallet = () => {
  const { connectWallet, disconnectWallet } = useConnectWallet();
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [mnemonic] = useAtom(mnemonicAtom);

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  return (
    <div className="wallet-container">
      {!walletConnected ? (
        // Only show Connect button if there's a mnemonic to connect with
        mnemonic.trim() && (
          <button onClick={handleConnect} className="wallet-button connect">
            Connect Wallet
          </button>
        )
      ) : (
        <button onClick={handleDisconnect} className="wallet-button disconnect">
          Disconnect Wallet
        </button>
      )}
    </div>
  );
};

export default Wallet;