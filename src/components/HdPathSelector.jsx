import { useAtom } from 'jotai';
import { derivationModeAtom } from '../atoms';
import PropTypes from 'prop-types';
import './hdpathselector.css';

const HdPathSelector = ({ showLabel = true, compact = false }) => {
  const [derivationMode, setDerivationMode] = useAtom(derivationModeAtom);

  const handleModeChange = (mode) => {
    setDerivationMode(mode);
  };


  if (compact) {
    return (
      <div className="hdpath-selector compact">
        <select
          value={derivationMode}
          onChange={(e) => handleModeChange(e.target.value)}
          className="hdpath-select"
        >
          <option value="standard">Standard (899)</option>
          <option value="cashtab">CashTab (1899)</option>
        </select>
      </div>
    );
  }

  return (
    <div className="hdpath-selector">
      {showLabel && (
        <label className="hdpath-label">
          HD Derivation Path
        </label>
      )}

      <div className="hdpath-options">
        <div className="hdpath-option">
          <input
            type="radio"
            id="standard"
            name="derivationMode"
            value="standard"
            checked={derivationMode === 'standard'}
            onChange={(e) => handleModeChange(e.target.value)}
            className="hdpath-radio"
          />
          <label htmlFor="standard" className="hdpath-option-label">
            <div className="hdpath-option-title">
              Standard eCash (899)
            </div>
          </label>
        </div>

        <div className="hdpath-option">
          <input
            type="radio"
            id="cashtab"
            name="derivationMode"
            value="cashtab"
            checked={derivationMode === 'cashtab'}
            onChange={(e) => handleModeChange(e.target.value)}
            className="hdpath-radio"
          />
          <label htmlFor="cashtab" className="hdpath-option-label">
            <div className="hdpath-option-title">
              CashTab Compatible (1899)
            </div>
          </label>
        </div>
      </div>

    </div>
  );
};

HdPathSelector.propTypes = {
  showLabel: PropTypes.bool,
  compact: PropTypes.bool,
};

export default HdPathSelector;
