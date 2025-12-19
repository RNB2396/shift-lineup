import { useState, useEffect, useRef } from 'react';
import { lineupService, supabase } from '../lib/supabase';

function SavedLineups() {
  const [savedLineups, setSavedLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSavedLineups();
  }, []);

  const loadSavedLineups = async () => {
    if (!supabase) {
      setError('Supabase not configured. Please set up environment variables.');
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
      lateNight: 'Late Night'
    };
    return names[period] || period;
  };

  const getMatchBadgeClass = (quality) => {
    switch (quality) {
      case 'best': return 'match-badge best';
      case 'capable': return 'match-badge capable';
      case 'fallback': return 'match-badge fallback';
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
            >
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
            {selectedDate && (
              <button
                onClick={() => handleDeleteDate(selectedDate)}
                className="btn-small btn-danger"
                disabled={saving}
              >
                Delete Day
              </button>
            )}
          </div>

          <div className="drag-instructions">
            <p>Drag and drop employees to swap their positions within a time block.</p>
          </div>

          <div className="lineups-container">
            {filteredLineups.map((lineup) => (
              <div key={lineup.id} className="lineup-card saved">
                <div className="lineup-header">
                  <h3>{formatTime12Hour(lineup.startTime)} - {formatTime12Hour(lineup.endTime)}</h3>
                  <span className="shift-badge">{formatShiftPeriod(lineup.shiftPeriod)}</span>
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
