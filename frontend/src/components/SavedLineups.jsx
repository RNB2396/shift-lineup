import { useState, useEffect } from 'react';
import { lineupService, supabase } from '../lib/supabase';
import { lineupApi } from '../api';

function SavedLineups() {
  const [savedLineups, setSavedLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [shiftAssignments, setShiftAssignments] = useState([]);

  useEffect(() => {
    loadSavedLineups();
  }, []);

  const loadSavedLineups = async () => {
    if (!supabase) {
      setError('Supabase not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Netlify environment variables, then redeploy.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const lineups = await lineupService.getAllLineups();

      // Group by date
      const dates = [...new Set(lineups.map(l => l.date))];
      setAvailableDates(dates);

      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }

      setSavedLineups(lineups);
      setError(null);
    } catch (err) {
      console.error('Error loading lineups:', err);
      setError('Failed to load saved lineups');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, lineupId, assignment) => {
    setDraggedItem({ lineupId, assignment });
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragOver = (e, lineupId, assignment) => {
    e.preventDefault();
    if (draggedItem && draggedItem.lineupId === lineupId &&
        draggedItem.assignment.id !== assignment.id) {
      setDragOverItem({ lineupId, assignment });
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e, targetLineupId, targetAssignment) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.lineupId !== targetLineupId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const sourceAssignment = draggedItem.assignment;

    if (sourceAssignment.id === targetAssignment.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      setSaving(true);

      // Swap assignments in the database
      await lineupService.swapAssignments(sourceAssignment.id, targetAssignment.id);

      // Update local state
      setSavedLineups(prevLineups =>
        prevLineups.map(lineup => {
          if (lineup.id !== targetLineupId) return lineup;

          return {
            ...lineup,
            assignments: lineup.assignments.map(a => {
              if (a.id === sourceAssignment.id) {
                return { ...a, position: targetAssignment.position };
              }
              if (a.id === targetAssignment.id) {
                return { ...a, position: sourceAssignment.position };
              }
              return a;
            })
          };
        })
      );
    } catch (err) {
      console.error('Error swapping assignments:', err);
      alert('Failed to swap positions');
    } finally {
      setSaving(false);
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const handleDeleteDate = async (date) => {
    if (!confirm(`Delete all lineups for ${formatDate(date)}?`)) return;

    try {
      setSaving(true);
      await lineupService.deleteLineupsByDate(date);
      await loadSavedLineups();

      if (selectedDate === date) {
        setSelectedDate(availableDates.find(d => d !== date) || null);
      }
    } catch (err) {
      console.error('Error deleting lineups:', err);
      alert('Failed to delete lineups');
    } finally {
      setSaving(false);
    }
  };

  // Extract shift assignments from saved lineups for editing
  const enterEditMode = () => {
    const lineups = savedLineups.filter(l => l.date === selectedDate && l.shiftPeriod !== 'closing');

    // Build a map of employee shifts from the lineups
    const employeeShifts = new Map();

    for (const lineup of lineups) {
      for (const assignment of lineup.assignments) {
        if (!assignment.employee) continue;

        const empId = assignment.employee.id;
        const existing = employeeShifts.get(empId);

        if (!existing) {
          employeeShifts.set(empId, {
            employeeId: empId,
            name: assignment.employee.name,
            isMinor: assignment.employee.isMinor,
            positions: assignment.employee.positions || [],
            bestPositions: assignment.employee.bestPositions || [],
            startTime: lineup.startTime,
            endTime: lineup.endTime,
            isShiftLead: assignment.position.includes('lead'),
            isBooster: assignment.position.includes('booster'),
            isInTraining: assignment.position.includes('training')
          });
        } else {
          // Extend the time range
          if (lineup.startTime < existing.startTime) {
            existing.startTime = lineup.startTime;
          }
          if (lineup.endTime > existing.endTime) {
            existing.endTime = lineup.endTime;
          }
          // Check for roles
          if (assignment.position.includes('lead')) existing.isShiftLead = true;
          if (assignment.position.includes('booster')) existing.isBooster = true;
          if (assignment.position.includes('training')) existing.isInTraining = true;
        }
      }
    }

    setShiftAssignments(Array.from(employeeShifts.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    ));
    setEditMode(true);
  };

  const handleUpdateShiftTime = (employeeId, field, value) => {
    setShiftAssignments(prev => prev.map(s =>
      s.employeeId === employeeId ? { ...s, [field]: value } : s
    ));
  };

  const handleRemoveFromShift = (employeeId) => {
    setShiftAssignments(prev => prev.filter(s => s.employeeId !== employeeId));
  };

  const handleToggleRole = (employeeId, role) => {
    setShiftAssignments(prev => prev.map(s =>
      s.employeeId === employeeId ? { ...s, [role]: !s[role] } : s
    ));
  };

  const handleRegenerateLineups = async () => {
    if (shiftAssignments.length === 0) {
      alert('No employees in the shift');
      return;
    }

    try {
      setSaving(true);

      // Generate new lineups via API
      const result = await lineupApi.generate(shiftAssignments);

      // Delete old lineups for this date
      await lineupService.deleteLineupsByDate(selectedDate);

      // Save new lineups
      await lineupService.saveAllLineups(result.lineups, selectedDate, result.closingLineup);

      // Reload and exit edit mode
      await loadSavedLineups();
      setEditMode(false);

      alert('Lineups regenerated successfully!');
    } catch (err) {
      console.error('Error regenerating lineups:', err);
      alert('Failed to regenerate lineups: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime12Hour = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatShiftPeriod = (period) => {
    const names = {
      morning: 'Morning',
      lunch: 'Lunch',
      midday: 'Midday',
      dinner: 'Dinner',
      lateNight: 'Late Night',
      closing: 'Closing'
    };
    return names[period] || period;
  };

  const getMatchBadgeClass = (quality) => {
    switch (quality) {
      case 'best': return 'match-badge best';
      case 'capable': return 'match-badge capable';
      case 'fallback': return 'match-badge fallback';
      case 'training': return 'match-badge training';
      case 'extra': return 'match-badge extra';
      default: return 'match-badge';
    }
  };

  const filteredLineups = savedLineups.filter(l => l.date === selectedDate);

  if (loading) {
    return <div className="loading">Loading saved lineups...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="saved-lineups">
      <div className="section-header">
        <h2>Saved Lineups</h2>
        <button onClick={loadSavedLineups} className="btn-secondary" disabled={saving}>
          Refresh
        </button>
      </div>

      {availableDates.length === 0 ? (
        <p className="empty-state">
          No saved lineups yet. Generate a lineup and click "Save Lineup" to save it here.
        </p>
      ) : (
        <>
          <div className="date-selector">
            <label>Select Date:</label>
            <select
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={editMode}
            >
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
            {selectedDate && !editMode && (
              <>
                <button
                  onClick={enterEditMode}
                  className="btn-small btn-secondary"
                  disabled={saving}
                >
                  Edit Shifts
                </button>
                <button
                  onClick={() => handleDeleteDate(selectedDate)}
                  className="btn-small btn-danger"
                  disabled={saving}
                >
                  Delete Day
                </button>
              </>
            )}
            {editMode && (
              <>
                <button
                  onClick={handleRegenerateLineups}
                  className="btn-small btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Regenerating...' : 'Regenerate Lineups'}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="btn-small btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {!editMode && (
            <div className="drag-instructions">
              <p>Drag and drop employees to swap their positions within a time block.</p>
            </div>
          )}

          {editMode ? (
            <div className="edit-shifts-container">
              <h3>Edit Shift Times for {formatDate(selectedDate)}</h3>
              <p className="edit-instructions">
                Adjust shift times, toggle roles, or remove employees. Click "Regenerate Lineups" to create new position assignments.
              </p>

              <div className="shift-assignments-list">
                {shiftAssignments.map((shift) => (
                  <div key={shift.employeeId} className="shift-assignment-row">
                    <div className="shift-employee-info">
                      <span className="shift-employee-name">
                        {shift.name}
                        {shift.isMinor && <span className="minor-badge">Minor</span>}
                      </span>
                    </div>

                    <div className="shift-time-inputs">
                      <label>
                        Start:
                        <input
                          type="time"
                          value={shift.startTime}
                          onChange={(e) => handleUpdateShiftTime(shift.employeeId, 'startTime', e.target.value)}
                        />
                      </label>
                      <label>
                        End:
                        <input
                          type="time"
                          value={shift.endTime}
                          onChange={(e) => handleUpdateShiftTime(shift.employeeId, 'endTime', e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="shift-role-toggles">
                      <label className="role-checkbox">
                        <input
                          type="checkbox"
                          checked={shift.isShiftLead}
                          onChange={() => handleToggleRole(shift.employeeId, 'isShiftLead')}
                        />
                        Lead
                      </label>
                      <label className="role-checkbox">
                        <input
                          type="checkbox"
                          checked={shift.isBooster}
                          onChange={() => handleToggleRole(shift.employeeId, 'isBooster')}
                        />
                        Booster
                      </label>
                      <label className="role-checkbox">
                        <input
                          type="checkbox"
                          checked={shift.isInTraining}
                          onChange={() => handleToggleRole(shift.employeeId, 'isInTraining')}
                        />
                        Training
                      </label>
                    </div>

                    <button
                      onClick={() => handleRemoveFromShift(shift.employeeId)}
                      className="btn-small btn-danger"
                      title="Remove from shift"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {shiftAssignments.length === 0 && (
                <p className="empty-state">No employees in this shift. Cancel to go back.</p>
              )}
            </div>
          ) : (
            <div className="lineups-container">
            {filteredLineups.map((lineup) => (
              <div key={lineup.id} className={`lineup-card saved ${lineup.shiftPeriod === 'closing' ? 'closing-lineup' : ''}`}>
                <div className="lineup-header">
                  <h3>
                    {lineup.shiftPeriod === 'closing'
                      ? 'Closing'
                      : `${formatTime12Hour(lineup.startTime)} - ${formatTime12Hour(lineup.endTime)}`
                    }
                  </h3>
                  <span className={`shift-badge ${lineup.shiftPeriod === 'closing' ? 'closing' : ''}`}>
                    {formatShiftPeriod(lineup.shiftPeriod)}
                  </span>
                  <span className="count-badge">{lineup.peopleCount} people</span>
                </div>

                <div className="lineup-assignments draggable">
                  {lineup.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className={`assignment-card draggable-item ${
                        assignment.needsBreak ? 'needs-break' : ''
                      } ${
                        dragOverItem?.assignment.id === assignment.id ? 'drag-over' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lineup.id, assignment)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, lineup.id, assignment)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, lineup.id, assignment)}
                    >
                      <span className="drag-handle">&#8942;&#8942;</span>
                      <span className="assignment-position">{assignment.position}</span>
                      <span className="assignment-employee">
                        {assignment.employee?.name || 'Unknown'}
                        {assignment.employee?.isMinor && (
                          <span className="minor-badge">Minor</span>
                        )}
                      </span>
                      <div className="assignment-badges">
                        <span className={getMatchBadgeClass(assignment.matchQuality)}>
                          {assignment.matchQuality}
                        </span>
                        {assignment.needsBreak && (
                          <span className={`break-badge ${assignment.breakType}`}>
                            {assignment.breakType === 'required' ? 'BREAK' : 'Opt'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {lineup.extraPeople > 0 && (
                  <div className="extra-info">
                    Note: {lineup.extraPeople} extra person(s) beyond standard layout
                  </div>
                )}
              </div>
            ))}
            </div>
          )}
        </>
      )}

      {saving && (
        <div className="saving-overlay">
          <div className="saving-message">Saving changes...</div>
        </div>
      )}
    </div>
  );
}

export default SavedLineups;
