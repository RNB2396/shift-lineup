import { useState, useEffect } from 'react';
import { employeeApi, positionApi } from '../api';

const ALL_POSITIONS = [
  "primary",
  "secondary1",
  "secondary2",
  "breading",
  "machines",
  "DT fries",
  "FC fries",
  "buns"
];

function EmployeeManager({ employees, setEmployees, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    isMinor: false,
    positions: [],
    bestPositions: []
  });

  const resetForm = () => {
    setFormData({
      name: '',
      isMinor: false,
      positions: [],
      bestPositions: []
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
      bestPositions: employee.bestPositions || []
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
                <label>Positions (click to select):</label>
                <div className="position-grid">
                  {ALL_POSITIONS.map(position => (
                    <div
                      key={position}
                      className={`position-chip ${formData.positions.includes(position) ? 'selected' : ''}`}
                      onClick={() => togglePosition(position)}
                    >
                      {position}
                    </div>
                  ))}
                </div>
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
          employees.map(employee => (
            <div key={employee.id} className="employee-card">
              <div className="employee-info">
                <h4>
                  {employee.name}
                  {employee.isMinor && <span className="minor-badge">Minor</span>}
                </h4>
                <div className="employee-positions">
                  {employee.bestPositions?.map(pos => (
                    <span key={pos} className="pos-badge best">{pos}</span>
                  ))}
                  {employee.positions?.filter(p => !employee.bestPositions?.includes(p)).map(pos => (
                    <span key={pos} className="pos-badge">{pos}</span>
                  ))}
                </div>
              </div>
              <div className="employee-actions">
                <button onClick={() => handleEdit(employee)} className="btn-small">Edit</button>
                <button onClick={() => handleDelete(employee.id)} className="btn-small btn-danger">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmployeeManager;
