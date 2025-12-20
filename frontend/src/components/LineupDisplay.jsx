import { useState } from 'react';
import { lineupApi } from '../api';
import { lineupService, supabase } from '../lib/supabase';

function LineupDisplay({ shiftAssignments, lineups, setLineups, closingLineup, setClosingLineup, lineupDate, houseType }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (shiftAssignments.length === 0) {
      alert('Please add at least one shift assignment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await lineupApi.generate(shiftAssignments, houseType);
      setLineups(result.lineups);
      if (setClosingLineup) {
        setClosingLineup(result.closingLineup);
      }
    } catch (err) {
      console.error('Error generating lineup:', err);
      setError('Failed to generate lineup. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (lineups.length === 0) {
      alert('Please generate a lineup first');
      return;
    }

    try {
      await lineupApi.exportExcel(lineups);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Failed to export. Make sure the backend is running.');
    }
  };

  const handleSaveLineups = async () => {
    if (lineups.length === 0) {
      alert('Please generate a lineup first');
      return;
    }

    if (!supabase) {
      alert('Supabase not configured. Cannot save lineups.');
      return;
    }

    setSaving(true);
    try {
      await lineupService.saveAllLineups(lineups, lineupDate, closingLineup, houseType);
      const dateDisplay = new Date(lineupDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const houseLabel = houseType === 'foh' ? 'Front of House' : 'Back of House';
      alert(`${houseLabel} lineups saved for ${dateDisplay}! View them in the Saved Lineups tab.`);
    } catch (err) {
      console.error('Error saving lineups:', err);
      alert('Failed to save lineups: ' + err.message);
    } finally {
      setSaving(false);
    }
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

  const formatTime12Hour = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="lineup-display">
      <div className="section-header">
        <h2>Generated Lineups</h2>
        <div className="header-actions">
          <button
            onClick={handleGenerate}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Lineup'}
          </button>
          {lineups.length > 0 && (
            <>
              <button
                onClick={handleSaveLineups}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Lineup'}
              </button>
              <button onClick={handleExport} className="btn-secondary">
                Export to Excel
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {lineups.length === 0 ? (
        <p className="empty-state">
          Add shift assignments and click "Generate Lineup" to see position assignments.
        </p>
      ) : (
        <div className="lineups-container">
          {lineups.map((lineup, index) => (
            <div key={index} className="lineup-card">
              <div className="lineup-header">
                <h3>{formatTime12Hour(lineup.startTime)} - {formatTime12Hour(lineup.endTime)}</h3>
                <span className="shift-badge">{formatShiftPeriod(lineup.shiftPeriod)}</span>
                <span className="count-badge">{lineup.peopleCount} people</span>
              </div>

              {/* Mobile card view */}
              <div className="lineup-assignments">
                {lineup.assignments.map((assignment, i) => (
                  <div key={i} className={`assignment-card ${assignment.needsBreak ? 'needs-break' : ''}`}>
                    <span className="assignment-position">{assignment.position}</span>
                    <span className="assignment-employee">
                      {assignment.employee.name}
                      {assignment.employee.isMinor && (
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

              {/* Desktop table view */}
              <div className="table-wrapper">
                <table className="lineup-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Employee</th>
                      <th>Match</th>
                      <th>Break</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineup.assignments.map((assignment, i) => (
                      <tr key={i} className={assignment.needsBreak ? 'needs-break' : ''}>
                        <td className="position-cell">{assignment.position}</td>
                        <td>
                          {assignment.employee.name}
                          {assignment.employee.isMinor && (
                            <span className="minor-badge">Minor</span>
                          )}
                        </td>
                        <td>
                          <span className={getMatchBadgeClass(assignment.matchQuality)}>
                            {assignment.matchQuality}
                          </span>
                        </td>
                        <td>
                          {assignment.needsBreak && (
                            <span className={`break-badge ${assignment.breakType}`}>
                              {assignment.breakType === 'required' ? 'REQUIRED' : 'Optional'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {lineup.extraPeople > 0 && (
                <div className="extra-info">
                  Note: {lineup.extraPeople} extra person(s) beyond standard layout
                </div>
              )}
            </div>
          ))}

          {/* Closing Lineup Section */}
          {closingLineup && closingLineup.assignments && closingLineup.assignments.length > 0 && (
            <div className="lineup-card closing-lineup">
              <div className="lineup-header">
                <h3>Closing</h3>
                <span className="shift-badge closing">Closing Duties</span>
                <span className="count-badge">{closingLineup.peopleCount} people</span>
              </div>

              {/* Mobile card view */}
              <div className="lineup-assignments">
                {closingLineup.assignments.map((assignment, i) => (
                  <div key={i} className="assignment-card">
                    <span className="assignment-position">{assignment.position}</span>
                    <span className="assignment-employee">
                      {assignment.employee.name}
                      {assignment.employee.isMinor && (
                        <span className="minor-badge">Minor</span>
                      )}
                    </span>
                    <div className="assignment-badges">
                      <span className={getMatchBadgeClass(assignment.matchQuality)}>
                        {assignment.matchQuality}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="table-wrapper">
                <table className="lineup-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Employee</th>
                      <th>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closingLineup.assignments.map((assignment, i) => (
                      <tr key={i}>
                        <td className="position-cell">{assignment.position}</td>
                        <td>
                          {assignment.employee.name}
                          {assignment.employee.isMinor && (
                            <span className="minor-badge">Minor</span>
                          )}
                        </td>
                        <td>
                          <span className={getMatchBadgeClass(assignment.matchQuality)}>
                            {assignment.matchQuality}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="legend">
        <h4>Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="match-badge best">Best</span> Employee's best position
          </div>
          <div className="legend-item">
            <span className="match-badge capable">Capable</span> Can work this position
          </div>
          <div className="legend-item">
            <span className="match-badge fallback">Fallback</span> Assigned due to staffing
          </div>
          <div className="legend-item">
            <span className="match-badge training">Training</span> In training, shadowing
          </div>
          <div className="legend-item">
            <span className="match-badge extra">Extra</span> Extra support
          </div>
        </div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="break-badge required">REQUIRED</span> Break must be given
          </div>
          <div className="legend-item">
            <span className="break-badge optional">Optional</span> Break recommended
          </div>
        </div>
      </div>
    </div>
  );
}

export default LineupDisplay;
