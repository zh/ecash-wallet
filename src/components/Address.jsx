import PropTypes from 'prop-types';
import { useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { QRCodeSVG } from 'qrcode.react';
import { notificationAtom, walletConnectedAtom, walletAtom } from '../atoms';
import '../styles/address.css';

const Address = ({
  addressFormat = 'long',
  showQR = true,
  showEToken = false,
  showSwitch = false,
}) => {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const setNotification = useSetAtom(notificationAtom);
  const [walletConnected] = useAtom(walletConnectedAtom);
  const [wallet] = useAtom(walletAtom);
  const [selectedAddressType, setSelectedAddressType] = useState(showEToken ? 'eToken' : 'XEC');

  // CONDITIONAL RENDERING MOVED AFTER ALL HOOKS
  if (!walletConnected || !wallet) {
    return null;
  }

  const shortify = (address) => {
    // Handle XEC address format (ecash:prefix)
    const addressPart = address.includes(':') ? address.split(':')[1] : address;
    return `${addressPart.slice(0, 4)}...${addressPart.slice(-4)}`;
  };

  const handleSwitch = (type) => {
    setSelectedAddressType(type);
  };

  const handleCopyToClipboard = (address) => {
    navigator.clipboard.writeText(address).then(
      () => {
        setNotification({ type: 'success', message: 'Address copied to clipboard!' });
      },
      (err) => {
        console.error('Failed to copy address: ', err);
        setNotification({ type: 'error', message: 'Failed to copy address.' });
      }
    );
  };

  // Get the XEC address from wallet
  const xecAddress = wallet?.walletInfo?.xecAddress || wallet?.walletInfo?.address;

  // Convert XEC address to eToken address using the same address data but different prefix
  const getETokenAddress = (xecAddr) => {
    if (!xecAddr || !xecAddr.startsWith('ecash:')) {
      return xecAddr; // Return as-is if not a valid ecash address
    }

    try {
      // Use a simple prefix replacement approach
      // The address body remains the same, only prefix changes
      return xecAddr.replace('ecash:', 'etoken:');
    } catch (error) {
      console.warn('Failed to convert to eToken address:', error);
      return xecAddr; // Fallback to original address
    }
  };

  const eTokenAddress = getETokenAddress(xecAddress);
  const displayAddress = selectedAddressType === 'XEC' ? xecAddress : eTokenAddress;

  return (
    <>
      {showQR && (
        <div className="qr-code-container" onClick={() => handleCopyToClipboard(displayAddress)}>
          <QRCodeSVG
            value={displayAddress}
            size={200}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            includeMargin={true}
            marginSize={2}
          />
          <p className="qr-code-instruction">Click QR to copy address</p>
        </div>
      )}
      {showSwitch && (
        <div className="switch-address-container">
          <div className="switch">
            <input
              type="radio"
              id="xec"
              name="addressType"
              value="XEC"
              checked={selectedAddressType === 'XEC'}
              onChange={() => handleSwitch('XEC')}
            />
            <label htmlFor="xec">XEC</label>

            <input
              type="radio"
              id="etoken"
              name="addressType"
              value="eToken"
              checked={selectedAddressType === 'eToken'}
              onChange={() => handleSwitch('eToken')}
            />
            <label htmlFor="etoken">eToken</label>

            <div className="toggle"></div>
          </div>
        </div>
      )}
      <p className="wallet-address wallet-address-long">
        <strong>{`${selectedAddressType} Address:`}</strong> {addressFormat === 'long' ? displayAddress : shortify(displayAddress)}
      </p>
      <p className="wallet-address wallet-address-short">
        <strong>{selectedAddressType}</strong> {shortify(displayAddress)}
      </p>
    </>
  );
};

// PropTypes validation
Address.propTypes = {
  addressFormat: PropTypes.oneOf(['short', 'long']).isRequired, // 'short' or 'long' format
  showQR: PropTypes.bool, // Whether to display the QR code
  showEToken: PropTypes.bool, // Whether to display the eToken address by default
  showSwitch: PropTypes.bool, // Whether to display the XEC/eToken switch
};

export default Address;