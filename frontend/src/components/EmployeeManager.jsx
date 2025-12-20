import { useState, useEffect } from 'react';
import { employeeApi, positionApi } from '../api';

function EmployeeManager({ employees, onRefresh, houseType }) {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [availablePositions, setAvailablePositions] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    isMinor: false,
    positions: [],
    bestPositions: [],
    houseType: 'boh'
  });

  // Load positions from API
  useEffect(() => {
    const loadPositions = async () => {
      try {
        const positions = await positionApi.getAll();
        setAvailablePositions(positions);
      } catch (error) {
        console.error('Error loading positions:', error);
      }
    };
    loadPositions();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      isMinor: false,
      positions: [],
      bestPositions: [],
      houseType: houseType || 'boh'
    });
    setEditingEmployee(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await employeeApi.update(editingEmployee.id, formData);
      } else {
        await employeeApi.create(formData);
      }
      onRefresh();
      resetForm();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Failed to save employee');
    }
  };

  const handleEdit = (employee) => {
    setFormData({
      name: employee.name,
      isMinor: employee.isMinor,
      positions: employee.positions || [],
      bestPositions: employee.bestPositions || [],
      houseType: employee.houseType || 'boh'
    });
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await employeeApi.delete(id);
      onRefresh();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee');
    }
  };

  const togglePosition = (position) => {
    setFormData(prev => {
      const newPositions = prev.positions.includes(position)
        ? prev.positions.filter(p => p !== position)
        : [...prev.positions, position];

      // Remove from best positions if no longer in positions
      const newBestPositions = prev.bestPositions.filter(p => newPositions.includes(p));

      return {
        ...prev,
        positions: newPositions,
        bestPositions: newBestPositions
      };
    });
  };

  const toggleBestPosition = (position) => {
    if (!formData.positions.includes(position)) return;

    setFormData(prev => ({
      ...prev,
      bestPositions: prev.bestPositions.includes(position)
        ? prev.bestPositions.filter(p => p !== position)
        : [...prev.bestPositions, position]
    }));
  };

  return (
    <div className="employee-manager">
      <div className="section-header">
        <h2>Employees</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Add Employee
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isMinor}
                    onChange={(e) => setFormData({ ...formData, isMinor: e.target.checked })}
                  />
                  Minor (under 18)
                </label>
              </div>

              <div className="form-group">
                <label>House Assignment:</label>
                <div className="house-radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="houseType"
                      value="foh"
                      checked={formData.houseType === 'foh'}
                      onChange={(e) => setFormData({ ...formData, houseType: e.target.value, positions: [], bestPositions: [] })}
                    />
                    Front of House
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="houseType"
                      value="boh"
                      checked={formData.houseType === 'boh'}
                      onChange={(e) => setFormData({ ...formData, houseType: e.target.value, positions: [], bestPositions: [] })}
                    />
                    Back of House
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="houseType"
                      value="both"
                      checked={formData.houseType === 'both'}
                      onChange={(e) => setFormData({ ...formData, houseType: e.target.value, positions: [], bestPositions: [] })}
                    />
                    Both
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Positions (click to select):</label>
                <div className="position-grid">
                  {availablePositions
                    .filter(pos => {
                      if (formData.houseType === 'both') return true;
                      return pos.houseType === formData.houseType;
                    })
                    .map(position => (
                    <div
                      key={position.id}
                      className={`position-chip ${formData.positions.includes(position.name) ? 'selected' : ''}`}
                      onClick={() => togglePosition(position.name)}
                    >
                      {position.name}
                      {formData.houseType === 'both' && (
                        <span className="house-indicator">{position.houseType.toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                </div>
                {availablePositions.filter(pos => {
                  if (formData.houseType === 'both') return true;
                  return pos.houseType === formData.houseType;
                }).length === 0 && (
                  <p className="empty-positions">No positions configured for this house type. Add positions in the Positions tab first.</p>
                )}
              </div>

              {formData.positions.length > 0 && (
                <div className="form-group">
                  <label>Best Positions (click to mark as best):</label>
                  <div className="position-grid">
                    {formData.positions.map(position => (
                      <div
                        key={position}
                        className={`position-chip best ${formData.bestPositions.includes(position) ? 'selected' : ''}`}
                        onClick={() => toggleBestPosition(position)}
                      >
                        {position}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingEmployee ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="employee-list">
        {employees.length === 0 ? (
          <p className="empty-state">No employees added yet. Add your first employee!</p>
        ) : (
          employees
            .filter(emp => {
              const empHouseType = emp.houseType || 'boh';
              return empHouseType === houseType || empHouseType === 'both';
            })
            .map(employee => {
              const positions = Array.isArray(employee.positions) ? employee.positions : [];
              const bestPositions = Array.isArray(employee.bestPositions) ? employee.bestPositions : [];
              const empHouseType = employee.houseType || 'boh';
              return (
                <div key={employee.id} className="employee-card">
                  <div className="employee-info">
                    <h4>
                      {employee.name}
                      {employee.isMinor && <span className="minor-badge">Minor</span>}
                      <span className={`house-badge ${empHouseType}`}>
                        {empHouseType === 'foh' ? 'FOH' : empHouseType === 'boh' ? 'BOH' : 'Both'}
                      </span>
                    </h4>
                    <div className="employee-positions">
                      {bestPositions.map(pos => (
                        <span key={pos} className="pos-badge best">{pos}</span>
                      ))}
                      {positions.filter(p => !bestPositions.includes(p)).map(pos => (
                        <span key={pos} className="pos-badge">{pos}</span>
                      ))}
                    </div>
                  </div>
                  <div className="employee-actions">
                    <button onClick={() => handleEdit(employee)} className="btn-small">Edit</button>
                    <button onClick={() => handleDelete(employee.id)} className="btn-small btn-danger">Delete</button>
                  </div>
                </div>
              );
            })
        )}
        {employees.length > 0 && employees.filter(emp => {
          const empHouseType = emp.houseType || 'boh';
          return empHouseType === houseType || empHouseType === 'both';
        }).length === 0 && (
          <p className="empty-state">
            No employees assigned to {houseType === 'foh' ? 'Front of House' : 'Back of House'}.
          </p>
        )}
      </div>
    </div>
  );
}

export default EmployeeManager;
