import { useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { walletConnectedAtom, walletAtom } from '../atoms';
import { ChronikClient } from 'chronik-client';

const chronikServers = [
  'https://chronik-native1.fabien.cash',
  'https://chronik-native2.fabien.cash',
];

let currentServerIndex = 0;

// Function to create a new Chronik client instance with the current server
const getChronikClient = () => {
  return new ChronikClient(chronikServers[currentServerIndex]);
};

// Function to switch to the next available Chronik server
const switchServer = () => {
  currentServerIndex = (currentServerIndex + 1) % chronikServers.length;
  console.warn(`Switching to Chronik server: ${chronikServers[currentServerIndex]}`);
};


const useWallet = (refreshInterval = 10000) => {
  const [walletConnected, setWalletConnected] = useAtom(walletConnectedAtom);
  const [wallet, setWallet] = useAtom(walletAtom);

  // Memoize fetchBalance to avoid creating a new function on each render
  const connectChronik = useCallback(async () => {
    if (walletConnected) return;

    for (let i = 0; i < chronikServers.length; i++) {
      try {
        const chronik = getChronikClient();
        if (chronik) {
         console.log(`Connected to Chronik server: ${chronikServers[i]}`);
          setWallet(chronik);
          setWalletConnected(true);
        }
      } catch {
        switchServer();
      }
    }
  }, [walletConnected, setWallet, setWalletConnected]);

  useEffect(() => {
    if (!walletConnected) {
      connectChronik(); // Fetch balance when wallet connects
      const interval = setInterval(connectChronik, refreshInterval); // Refresh every 5 seconds
      return () => clearInterval(interval); // Cleanup interval on unmount or disconnect
    }
  }, [walletConnected, connectChronik, refreshInterval]);

  return { wallet };
};

export default useWallet;
