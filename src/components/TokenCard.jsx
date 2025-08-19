import PropTypes from 'prop-types';
import Address from './Address';
import SendTokens from './SendTokens';
import TokenIcon from './TokenIcon';
import '../styles/tokencard.css';

const TokenCard = ({
  token,
  onClick = null,
  onZoomOut = null,
  zoomed = false,
}) => {
  // Guard against undefined token
  if (!token) {
    return (
      <div className="token-card error">
        <div className="token-error">
          <p>⚠️ Token data unavailable</p>
        </div>
      </div>
    );
  }

  const {
    tokenId = 'unknown',
    name = 'Unknown Token',
    symbol = 'N/A',
    balance = 0,
    decimals = 0,
    type = 'Unknown'
  } = token;

  const shortify = (id) => {
    if (!id || typeof id !== 'string') return 'N/A';
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  const formatTokenBalance = (balance) => {
    if (!balance || balance === 0) return '0';

    // Since we're using balance.display, no need for complex formatting
    if (typeof balance === 'number') {
      return balance.toString();
    }
    return String(balance);
  };

  if (zoomed) {
    return (
      <div className="token-card zoomed">
        <button
          className="back-button"
          onClick={onZoomOut}
          disabled={!onZoomOut}
        >
          Close
        </button>
        <TokenIcon token={token} zoomed={true} />
        <div className="token-details zoomed-details">
          <div className="token-id token-id-long"><strong>Token ID:</strong> {tokenId}</div>
          <div className="token-name"><strong>Name:</strong> {name}</div>
          <div className="token-ticker"><strong>Symbol:</strong> {symbol}</div>
          <div className="token-type"><strong>Type:</strong> {type}</div>
          <div className="token-decimals"><strong>Decimals:</strong> {decimals}</div>
          <div className="token-amount"><strong>Balance:</strong> {formatTokenBalance(balance)}</div>
        </div>
        <Address addressFormat={'long'} showQR={true} />
        <SendTokens preSelectedToken={token} />
      </div>
    );
  }

  return (
    <div className="token-card" onClick={onClick}>
      <TokenIcon token={token} zoomed={false} />
      <div className="token-details">
        <div className="token-card-name"><strong>Name:</strong> {name}</div>
        <div className="token-card-ticker"><strong>Symbol:</strong> {symbol}</div>
        <div className="token-card-type"><strong>Type:</strong> {type}</div>
        <div className="token-card-amount"><strong>Balance:</strong> {formatTokenBalance(balance)}</div>
      </div>
    </div>
  );
};

TokenCard.propTypes = {
  token: PropTypes.shape({
    tokenId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    symbol: PropTypes.string.isRequired,
    balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    decimals: PropTypes.number,
    type: PropTypes.string,
  }).isRequired,
  onClick: PropTypes.func,
  onZoomOut: PropTypes.func,
  zoomed: PropTypes.bool,
};

export default TokenCard;
