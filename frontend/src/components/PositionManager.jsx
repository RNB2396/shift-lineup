import { useState, useEffect } from 'react';
import { positionApi } from '../api';
import './PositionManager.css';

const TIME_PERIODS = [
  { value: 'all', label: 'All Periods' },
  { value: 'morning', label: 'Morning (6:00-10:30)' },
  { value: 'lunch', label: 'Lunch (10:30-2:00)' },
  { value: 'midday', label: 'Midday (2:00-5:00)' },
  { value: 'dinner', label: 'Dinner (5:00-8:00)' },
  { value: 'lateNight', label: 'Late Night (8:00-10:00)' }
];

function PositionManager({ houseType }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    houseType: houseType,
    priority: 99,
    timePeriods: ['all']
  });

  useEffect(() => {
    loadPositions();
  }, [houseType]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, houseType }));
  }, [houseType]);

  const loadPositions = async () => {
    try {
      setLoading(true);
      const data = await positionApi.getAll(houseType);
      setPositions(data);
    } catch (error) {
      console.error('Error loading positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      houseType: houseType,
      priority: 99,
      timePeriods: ['all']
    });
    setEditingPosition(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPosition) {
        await positionApi.update(editingPosition.id, formData);
      } else {
        await positionApi.create(formData);
      }
      loadPositions();
      resetForm();
    } catch (error) {
      console.error('Error saving position:', error);
      alert('Failed to save position');
    }
  };

  const handleEdit = (position) => {
    setFormData({
      name: position.name,
      houseType: position.houseType,
      priority: position.priority,
      timePeriods: position.timePeriods || ['all']
    });
    setEditingPosition(position);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this position?')) return;
    try {
      await positionApi.delete(id);
      loadPositions();
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('Failed to delete position');
    }
  };

  const toggleTimePeriod = (period) => {
    setFormData(prev => {
      let newPeriods;

      if (period === 'all') {
        // If clicking "all", set to just "all"
        newPeriods = ['all'];
      } else {
        // Remove "all" if it was selected and we're selecting specific periods
        const withoutAll = prev.timePeriods.filter(p => p !== 'all');

        if (prev.timePeriods.includes(period)) {
          newPeriods = withoutAll.filter(p => p !== period);
          // If no periods left, default to "all"
          if (newPeriods.length === 0) {
            newPeriods = ['all'];
          }
        } else {
          newPeriods = [...withoutAll, period];
        }
      }

      return { ...prev, timePeriods: newPeriods };
    });
  };

  if (loading) {
    return <div className="loading">Loading positions...</div>;
  }

  return (
    <div className="position-manager">
      <div className="section-header">
        <h2>{houseType === 'foh' ? 'Front of House' : 'Back of House'} Positions</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Add Position
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingPosition ? 'Edit Position' : 'Add Position'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Position Name:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., primary, breading, machines"
                  required
                />
              </div>

              <div className="form-group">
                <label>Priority (lower = filled first):</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 99 })}
                  required
                />
                <small>Positions with lower priority numbers are filled first when generating lineups.</small>
              </div>

              <div className="form-group">
                <label>Time Periods (when this position is used):</label>
                <div className="time-period-grid">
                  {TIME_PERIODS.map(period => (
                    <div
                      key={period.value}
                      className={`time-period-chip ${formData.timePeriods.includes(period.value) ? 'selected' : ''}`}
                      onClick={() => toggleTimePeriod(period.value)}
                    >
                      {period.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingPosition ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="position-list">
        {positions.length === 0 ? (
          <p className="empty-state">
            No positions configured for {houseType === 'foh' ? 'Front of House' : 'Back of House'} yet.
            Add your first position!
          </p>
        ) : (
          positions.map(position => (
            <div key={position.id} className="position-card">
              <div className="position-info">
                <div className="position-header">
                  <h4>{position.name}</h4>
                  <span className="priority-badge">Priority: {position.priority}</span>
                </div>
                <div className="position-periods">
                  {(position.timePeriods || ['all']).map(period => (
                    <span key={period} className="period-badge">
                      {period === 'all' ? 'All Periods' : period}
                    </span>
                  ))}
                </div>
              </div>
              <div className="position-actions">
                <button onClick={() => handleEdit(position)} className="btn-small">Edit</button>
                <button onClick={() => handleDelete(position.id)} className="btn-small btn-danger">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PositionManager;
