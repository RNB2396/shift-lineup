import './HouseToggle.css';

function HouseToggle({ value, onChange }) {
  return (
    <div className="house-toggle">
      <button
        className={`toggle-btn ${value === 'foh' ? 'active' : ''}`}
        onClick={() => onChange('foh')}
      >
        Front of House
      </button>
      <button
        className={`toggle-btn ${value === 'boh' ? 'active' : ''}`}
        onClick={() => onChange('boh')}
      >
        Back of House
      </button>
    </div>
  );
}

export default HouseToggle;
