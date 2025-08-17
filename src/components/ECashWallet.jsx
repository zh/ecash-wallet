import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAtom } from 'jotai';
import { mnemonicAtom, walletAtom, walletConnectedAtom, balanceAtom } from '../atoms';
import { QRCodeSVG } from 'qrcode.react';
import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { wordlist } from '@scure/bip39/wordlists/english';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { encodeCashAddress, decodeCashAddress } from 'ecashaddrjs';
import { useWallet } from '../hooks';
import SendXEC from './SendXEC';
import './ecashwallet.css';

const ECashWallet = () => {
  const [mnemonic, setMnemonic] = useAtom(mnemonicAtom);
  const [wallet] = useAtom(walletAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [balance, setBalance] = useAtom(balanceAtom);
  const [xecAddress, setXecAddress] = useState('');

  useWallet();

  useEffect(() => {
    if (!walletConnected || !wallet) return;

    console.log(`${xecAddress} balance:`)
    const fetchBalance = async () => {
      try {
        const { hash } = decodeCashAddress(xecAddress);
        const chronikUtxos = await wallet.script('p2pkh', hash).utxos();
        const slpUtxos = [];
        const nonSlpUtxos = [];
        for (const utxo of chronikUtxos.utxos) {
          if (typeof utxo.token !== 'undefined') {
            slpUtxos.push(utxo);
          } else {
            nonSlpUtxos.push(utxo);
          }
        }
        const totalValue = nonSlpUtxos.reduce((sum, utxo) => {
          return sum + utxo.value;
        }, 0);

        if (totalValue !== balance) {
          setBalance(totalValue);
        }
        console.log(`Balance for ${xecAddress}: ${totalValue} satoshis ${totalValue / 100.0} XEC`);
      } catch (error) {
        console.error(`Error fetching balance:`, error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [walletConnected, wallet, xecAddress, balance, setBalance]);

  const handleGenerateMnemonic = () => {
    const newMnemonic = generateMnemonic(wordlist);
    setMnemonic(newMnemonic);
  };

  const handleSaveMnemonic = () => {
    if (!mnemonic.trim()) {
      alert('Mnemonic is empty. Please generate or enter a valid mnemonic.');
      return;
    }
    if (!validateMnemonic(mnemonic, wordlist)) {
      alert('Invalid mnemonic. Please check your input.');
      return;
    }
    localStorage.setItem('xec-mnemonic', mnemonic);
    alert('Mnemonic saved successfully!');
  };

  const handleResetMnemonic = () => {
    if (window.confirm('Are you sure you want to reset the mnemonic?')) {
      setMnemonic('');
      localStorage.removeItem('xec-mnemonic');
    }
  };

  const deriveAddressFromMnemonic = (mnemonic) => {
    if (!validateMnemonic(mnemonic, wordlist)) {
      alert('Invalid mnemonic!');
      return null;
    }

    // Generate seed from mnemonic
    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);

    // Derive the eCash address path (m/44'/1899'/0'/0/0)
    const key = hdKey.derive("m/44'/1899'/0'/0/0");

    // Get the public key
    const publicKey = key.publicKey;

    // Hash the public key to get the public key hash
    const sha256Hash = sha256(publicKey);
    const publicKeyHash = ripemd160(sha256Hash);

    // Encode the address
    const type = 'p2pkh'; // Pay to Public Key Hash
    const ecashAddress = encodeCashAddress('ecash', type, publicKeyHash);

    return ecashAddress;
  };

  const connectWallet = () => {
    if (!wallet) {
      console.log('server not connected.');
      return;
    }

    if (!mnemonic.trim()) {
      alert('Please enter or generate a mnemonic first.');
      return;
    }
    const address = deriveAddressFromMnemonic(mnemonic);
    if (!address) return;

    setXecAddress(address);
  };

  return (
    <div className="ecash-wallet">
        <>
          <div className="mnemonic-section">
            <label>Mnemonic Phrase:</label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter or generate a mnemonic"
              rows="3"
            />
            <div className="mnemonic-buttons">
              <button onClick={handleGenerateMnemonic}>Generate</button>
              <button onClick={handleSaveMnemonic}>Save</button>
              <button onClick={handleResetMnemonic}>Reset</button>
            </div>
          </div>

          {walletConnected && (
            <>
            <QRCodeSVG value={xecAddress} size={128} className="wallet-qr" />
            <p><strong>Address:</strong> {xecAddress}</p>
            <p>
              <strong>Balance:</strong>
              {balance ? balance / 100.0 : '0' } XEC
              {balance && `(${balance} sats)`}
            </p>
            <p><SendXEC address={xecAddress} /></p>
            </>
          )}

          <button className="connect-btn" onClick={connectWallet}>Connect Wallet</button>
        </>
    </div>
  );
};

ECashWallet.propTypes = {
  onConnect: PropTypes.func,
  onDisconnect: PropTypes.func,
};

export default ECashWallet;

