import { useAuth } from '../context/AuthContext';
import './StoreSelector.css';

function StoreSelector() {
  const { stores, selectStore, logout } = useAuth();

  return (
    <div className="store-selector-container">
      <div className="store-selector-card">
        <div className="store-selector-header">
          <h1>Select Your Store</h1>
          <p>Choose which store you want to manage</p>
        </div>

        <div className="store-list">
          {stores.map((store) => (
            <button
              key={store.id}
              className="store-option"
              onClick={() => selectStore(store)}
            >
              <div className="store-info">
                <span className="store-name">{store.name}</span>
                {store.storeNumber && (
                  <span className="store-number">#{store.storeNumber}</span>
                )}
              </div>
              <span className={`store-role role-${store.role}`}>
                {store.role}
              </span>
            </button>
          ))}
        </div>

        <div className="store-selector-footer">
          <button className="logout-link" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoreSelector;
