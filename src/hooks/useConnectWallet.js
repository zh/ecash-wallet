// src/hooks/useConnectWallet.js
import { useAtom } from 'jotai';
import { mnemonicAtom, optionsAtom, walletConnectedAtom, walletAtom } from '../atoms';

const useConnectWallet = () => {
  const [mnemonic] = useAtom(mnemonicAtom);
  const [options] = useAtom(optionsAtom);
  const [walletConnected, setWalletConnected] = useAtom(walletConnectedAtom);
  const [, setWallet] = useAtom(walletAtom);

  const connectWallet = async () => {
    try {
      if (!mnemonic.trim()) {
        throw new Error('Mnemonic is required to initialize wallet.');
      }

      if (!window.MinimalXecWallet) {
        throw new Error('XEC wallet library is not available.');
      }

      const XecLibrary = window.MinimalXecWallet;
      const xecWallet = new XecLibrary(mnemonic, options);

      // Initialize the wallet
      await xecWallet.initialize();

      setWallet(xecWallet);
      setWalletConnected(true);
    } catch (error) {
      setWallet(null);
      setWalletConnected(false);
      throw new Error(error.message);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setWalletConnected(false);
  };

  return {
    connectWallet,
    disconnectWallet,
    walletConnected,
  };
};

export default useConnectWallet;