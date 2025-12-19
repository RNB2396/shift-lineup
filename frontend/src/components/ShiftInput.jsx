import { useState } from 'react';

function ShiftInput({ employees = [], shiftAssignments = [], setShiftAssignments }) {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('22:00');
  const [isShiftLead, setIsShiftLead] = useState(false);

  // Ensure we have arrays
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeAssignments = Array.isArray(shiftAssignments) ? shiftAssignments : [];

  const handleAddShift = () => {
    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    const employee = safeEmployees.find(e => e.id === selectedEmployee);
    if (!employee) return;

    // Check if employee already has a shift
    if (safeAssignments.some(s => s.employeeId === selectedEmployee)) {
      alert('This employee already has a shift assigned');
      return;
    }

    // If marking as shift lead, remove lead status from any existing assignment
    let updatedAssignments = safeAssignments;
    if (isShiftLead) {
      updatedAssignments = safeAssignments.map(s => ({ ...s, isShiftLead: false }));
    }

    setShiftAssignments([
      ...updatedAssignments,
      {
        employeeId: employee.id,
        name: employee.name,
        isMinor: employee.isMinor,
        positions: employee.positions,
        bestPositions: employee.bestPositions,
        startTime,
        endTime,
        isShiftLead
      }
    ]);

    setSelectedEmployee('');
    setIsShiftLead(false);
  };

  const handleRemoveShift = (employeeId) => {
    setShiftAssignments(safeAssignments.filter(s => s.employeeId !== employeeId));
  };

  const handleUpdateTime = (employeeId, field, value) => {
    setShiftAssignments(safeAssignments.map(s =>
      s.employeeId === employeeId ? { ...s, [field]: value } : s
    ));
  };

  const handleToggleLead = (employeeId) => {
    setShiftAssignments(safeAssignments.map(s => {
      if (s.employeeId === employeeId) {
        // Toggle this employee's lead status
        return { ...s, isShiftLead: !s.isShiftLead };
      } else {
        // Remove lead status from others if we're setting a new lead
        const targetShift = safeAssignments.find(sh => sh.employeeId === employeeId);
        if (!targetShift?.isShiftLead) {
          return { ...s, isShiftLead: false };
        }
        return s;
      }
    }));
  };

  // Get employees not yet assigned
  const availableEmployees = safeEmployees.filter(
    e => !safeAssignments.some(s => s.employeeId === e.id)
  );

  // Sort assignments by start time
  const sortedAssignments = [...safeAssignments].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="shift-input">
      <h2>Today's Shift Assignments</h2>

      <div className="add-shift-form">
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
        >
          <option value="">Select Employee...</option>
          {availableEmployees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name} {emp.isMinor ? '(Minor)' : ''}
            </option>
          ))}
        </select>

        <div className="time-inputs">
          <label>
            Start:
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label>
            End:
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>

        <label className="lead-checkbox">
          <input
            type="checkbox"
            checked={isShiftLead}
            onChange={(e) => setIsShiftLead(e.target.checked)}
          />
          Shift Lead
        </label>

        <button onClick={handleAddShift} className="btn-primary">
          Add to Shift
        </button>
      </div>

      <div className="shift-list">
        {sortedAssignments.length === 0 ? (
          <p className="empty-state">No shifts assigned yet. Add employees to today's schedule.</p>
        ) : (
          <>
            {/* Mobile card view */}
            {sortedAssignments.map(shift => {
              const startMins = parseInt(shift.startTime.split(':')[0]) * 60 + parseInt(shift.startTime.split(':')[1]);
              const endMins = parseInt(shift.endTime.split(':')[0]) * 60 + parseInt(shift.endTime.split(':')[1]);
              const hours = ((endMins - startMins) / 60).toFixed(1);

              return (
                <div key={shift.employeeId} className={`shift-card ${shift.isShiftLead ? 'lead-row' : ''}`}>
                  <div className="shift-card-header">
                    <span className="shift-card-name">
                      {shift.name}
                      {shift.isMinor && <span className="minor-badge">Minor</span>}
                    </span>
                    <button
                      onClick={() => handleRemoveShift(shift.employeeId)}
                      className="btn-small btn-danger"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="shift-card-times">
                    <label>
                      Start:
                      <input
                        type="time"
                        value={shift.startTime}
                        onChange={(e) => handleUpdateTime(shift.employeeId, 'startTime', e.target.value)}
                      />
                    </label>
                    <label>
                      End:
                      <input
                        type="time"
                        value={shift.endTime}
                        onChange={(e) => handleUpdateTime(shift.employeeId, 'endTime', e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="shift-card-footer">
                    <label className="shift-card-lead">
                      <input
                        type="checkbox"
                        checked={shift.isShiftLead || false}
                        onChange={() => handleToggleLead(shift.employeeId)}
                      />
                      Shift Lead
                    </label>
                    <span className="shift-card-hours">{hours} hrs</span>
                  </div>
                </div>
              );
            })}

            {/* Desktop table view */}
            <table className="shift-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Lead</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Hours</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssignments.map(shift => {
                  const startMins = parseInt(shift.startTime.split(':')[0]) * 60 + parseInt(shift.startTime.split(':')[1]);
                  const endMins = parseInt(shift.endTime.split(':')[0]) * 60 + parseInt(shift.endTime.split(':')[1]);
                  const hours = ((endMins - startMins) / 60).toFixed(1);

                  return (
                    <tr key={shift.employeeId} className={shift.isShiftLead ? 'lead-row' : ''}>
                      <td>
                        {shift.name}
                        {shift.isMinor && <span className="minor-badge">Minor</span>}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={shift.isShiftLead || false}
                          onChange={() => handleToggleLead(shift.employeeId)}
                          title="Mark as shift lead"
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={shift.startTime}
                          onChange={(e) => handleUpdateTime(shift.employeeId, 'startTime', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={shift.endTime}
                          onChange={(e) => handleUpdateTime(shift.employeeId, 'endTime', e.target.value)}
                        />
                      </td>
                      <td>{hours} hrs</td>
                      <td>
                        <button
                          onClick={() => handleRemoveShift(shift.employeeId)}
                          className="btn-small btn-danger"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="shift-summary">
        <strong>Total Staff: {safeAssignments.length}</strong>
      </div>
    </div>
  );
}

export default ShiftInput;
