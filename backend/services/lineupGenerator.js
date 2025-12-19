const { positionLayouts, getShiftPeriod, getLayout } = require('../config/positionLayouts');

/**
 * Parse time string to minutes from midnight
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes to time string
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get all time points where staff changes occur
 */
function getChangePoints(shiftAssignments) {
  const points = new Set();

  shiftAssignments.forEach(assignment => {
    points.add(timeToMinutes(assignment.startTime));
    points.add(timeToMinutes(assignment.endTime));
  });

  return Array.from(points).sort((a, b) => a - b);
}

/**
 * Get employees working at a specific time
 */
function getWorkingEmployees(shiftAssignments, timeInMinutes) {
  return shiftAssignments.filter(assignment => {
    const start = timeToMinutes(assignment.startTime);
    const end = timeToMinutes(assignment.endTime);
    return timeInMinutes >= start && timeInMinutes < end;
  });
}

/**
 * Calculate break flags for employees
 */
function calculateBreakFlags(employee, startTime, endTime) {
  const hoursWorked = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;

  if (employee.isMinor) {
    // Minors: break required at 4.5 hours, optional at 4 hours
    if (hoursWorked >= 4.5) {
      return { needsBreak: true, breakType: 'required' };
    } else if (hoursWorked >= 4) {
      return { needsBreak: true, breakType: 'optional' };
    }
  } else {
    // Adults: break required at 7.5 hours, optional at 7 hours
    if (hoursWorked >= 7.5) {
      return { needsBreak: true, breakType: 'required' };
    } else if (hoursWorked >= 7) {
      return { needsBreak: true, breakType: 'optional' };
    }
  }

  return { needsBreak: false, breakType: null };
}

/**
 * Check if an employee can work a position
 * Position can be like "secondary2/buns" meaning either skill works
 */
function canWorkPosition(employee, position) {
  const positionOptions = position.split('/');

  // Check if employee has any of the required skills
  return positionOptions.some(pos => {
    // Check best positions first
    if (employee.bestPositions && employee.bestPositions.includes(pos)) {
      return true;
    }
    // Then check all capable positions
    if (employee.positions && employee.positions.includes(pos)) {
      return true;
    }
    return false;
  });
}

/**
 * Position priorities - lower number = higher priority (fill first)
 * Positions are filled with employees marked as "best" at that position first
 * Priority order: leader=1, breading=2, machines=3, primary=4, secondary1=5,
 * DT fries=6, secondary2=7, buns=8, FC fries=9
 */
const positionPriorities = {
  'lead': 1,
  'breading': 2,
  'breader': 2,
  'machines': 3,
  'primary': 4,
  'secondary1': 5,
  'DT fries': 6,
  'secondary2': 7,
  'buns': 8,
  'FC fries': 9,
  'fries': 6,
  'breaks': 10,
  'hashbrowns': 7,
  'griddle': 7,
  'fileter': 4,
  'primary2': 5
};

/**
 * Positions that a checklist person can be pulled from (in priority order)
 * Lower number = prefer to pull from this position first
 */
const checklistPositionPriority = {
  'buns': 1,
  'machines': 1,
  'secondary2': 2
};

/**
 * Check if time is during dinner rush (5:00 PM - 7:30 PM)
 * During this time, lead should be on buns instead of floating
 */
function isDinnerRush(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  // 5:00 PM (17:00) = 1020 minutes, 7:30 PM (19:30) = 1170 minutes
  return timeInMinutes >= 1020 && timeInMinutes < 1170;
}

/**
 * Get the priority of a position (handles combined positions like "secondary2/buns")
 * Returns the highest priority (lowest number) among the options
 */
function getPositionPriority(position) {
  const options = position.split('/');
  let highestPriority = 99;

  for (const opt of options) {
    const priority = positionPriorities[opt] || 99;
    if (priority < highestPriority) {
      highestPriority = priority;
    }
  }

  return highestPriority;
}

/**
 * Score how well an employee fits a position (higher is better)
 * previousPosition: if employee was in this position before, give bonus to minimize moves
 */
function scoreEmployeeForPosition(employee, position, boostChecklistPositions = false, previousPosition = null) {
  const positionOptions = position.split('/');
  let bestScore = 0;

  for (const pos of positionOptions) {
    // Best position = 10 points
    if (employee.bestPositions && employee.bestPositions.includes(pos)) {
      bestScore = Math.max(bestScore, 10);
    }
    // Can do position = 5 points
    else if (employee.positions && employee.positions.includes(pos)) {
      bestScore = Math.max(bestScore, 5);
    }
  }

  // Boost score for checklist people on checklist-friendly positions
  if (boostChecklistPositions) {
    const hasChecklistSkill = employee.positions?.includes('checklist') ||
                              employee.bestPositions?.includes('checklist');
    if (hasChecklistSkill) {
      const basePosition = position.split('/')[0];
      if (checklistPositionPriority[basePosition] !== undefined) {
        // Add bonus points - higher bonus for priority 1 positions (buns, machines)
        const priorityBonus = checklistPositionPriority[basePosition] === 1 ? 15 : 12;
        bestScore += priorityBonus;
      }
    }
  }

  // Big bonus for staying in the same position (minimize moves)
  if (previousPosition) {
    const prevBase = previousPosition.replace(' (lead)', '').replace(' (floating)', '').split('/')[0];
    const currOptions = position.split('/');
    if (currOptions.includes(prevBase) || prevBase === position) {
      bestScore += 20; // Strong preference to stay in place
    }
  }

  return bestScore;
}

/**
 * Assign employees to positions using a greedy algorithm
 * Fills positions by priority (1=highest) and assigns best-matching employees first
 * People with checklist skill get boosted priority for buns, machines, secondary2
 * Lead is marked per-shift (isShiftLead flag) so leaders can work general positions some days
 * Leaders float and can place themselves anywhere - most important positions filled first with "best" employees
 * previousAssignments helps minimize position changes between periods
 */
function assignEmployeesToPositions(workingEmployees, positions, startTime, previousAssignments = {}) {
  const assignments = [];
  const unassigned = [...workingEmployees];
  const dinnerRush = isDinnerRush(startTime);

  // Filter out checklist and precloser from positions - these aren't real assignments
  const filteredPositions = positions.filter(pos => {
    const parts = pos.split('/');
    // Remove positions that are ONLY checklist or precloser
    return !parts.every(p => p === 'checklist' || p === 'precloser');
  }).map(pos => {
    // Remove checklist/precloser from combined positions
    const parts = pos.split('/').filter(p => p !== 'checklist' && p !== 'precloser');
    return parts.length > 0 ? parts.join('/') : pos;
  });

  // Handle shift lead first - uses isShiftLead flag set per shift, not position skill
  let leadAssigned = false;
  const leadIndex = unassigned.findIndex(emp => emp.isShiftLead === true);

  if (leadIndex !== -1) {
    const leadEmployee = unassigned[leadIndex];
    unassigned.splice(leadIndex, 1);

    // Lead floats - they can place themselves wherever needed
    assignments.push({
      employee: leadEmployee,
      position: 'lead (floating)',
      matchQuality: 'best'
    });
    leadAssigned = true;
  }

  // Sort positions by priority (lower number = higher priority = fill first)
  // Lead floats so all positions need to be filled
  const positionsToFill = filteredPositions;

  const sortedPositions = [...positionsToFill].map(pos => ({
    position: pos,
    priority: getPositionPriority(pos)
  })).sort((a, b) => a.priority - b.priority);

  // First pass: assign employees to positions in priority order
  // Use checklist boost so shift leads get placed on buns/machines/secondary2
  // Also consider previous assignments to minimize position changes
  for (const { position } of sortedPositions) {
    // Find the best employee for this position
    let bestEmployee = null;
    let bestScore = 0;
    let bestIndex = -1;

    for (let j = 0; j < unassigned.length; j++) {
      const employee = unassigned[j];
      // Get this employee's previous position (if any)
      const employeeId = employee.employeeId || employee.id || employee.name;
      const prevPosition = previousAssignments[employeeId];
      // Enable checklist boost and pass previous position for stability bonus
      const score = scoreEmployeeForPosition(employee, position, true, prevPosition);

      if (score > bestScore) {
        bestScore = score;
        bestEmployee = employee;
        bestIndex = j;
      }
    }

    if (bestEmployee && bestScore > 0) {
      // Determine match quality based on base score (without boosts)
      const baseScore = scoreEmployeeForPosition(bestEmployee, position, false, null);
      assignments.push({
        employee: bestEmployee,
        position: position,
        matchQuality: baseScore >= 10 ? 'best' : baseScore >= 5 ? 'capable' : 'fallback'
      });
      unassigned.splice(bestIndex, 1);
    } else if (unassigned.length > 0) {
      // No good match found, assign someone as fallback
      const employee = unassigned.shift();
      assignments.push({
        employee: employee,
        position: position,
        matchQuality: 'fallback'
      });
    }
  }

  // Any remaining unassigned employees become "extra/support"
  for (const employee of unassigned) {
    assignments.push({
      employee: employee,
      position: 'extra/support',
      matchQuality: 'extra'
    });
  }

  // Re-sort assignments to match original position order for display
  const positionOrder = {};
  positionOrder['lead (floating)'] = -1;  // Lead shows first
  positionOrder['buns (lead)'] = -1;      // Lead on buns shows first
  filteredPositions.forEach((pos, idx) => positionOrder[pos] = idx);
  positionOrder['extra/support'] = 999;

  assignments.sort((a, b) => {
    const orderA = positionOrder[a.position] ?? 999;
    const orderB = positionOrder[b.position] ?? 999;
    return orderA - orderB;
  });

  return assignments;
}

/**
 * Generate lineups for all time periods
 */
function generateLineups(shiftAssignments, employees) {
  // Merge employee data with shift assignments
  const enrichedAssignments = shiftAssignments.map(assignment => {
    const employee = employees.find(e => e.id === assignment.employeeId) || {};
    return {
      ...assignment,
      ...employee,
      name: assignment.name || employee.name
    };
  });

  const changePoints = getChangePoints(enrichedAssignments);
  const lineups = [];

  // Track previous assignments to minimize position changes
  let previousAssignments = {};

  for (let i = 0; i < changePoints.length - 1; i++) {
    const startMinutes = changePoints[i];
    const endMinutes = changePoints[i + 1];
    const startTime = minutesToTime(startMinutes);
    const endTime = minutesToTime(endMinutes);

    const workingEmployees = getWorkingEmployees(enrichedAssignments, startMinutes);
    const shiftPeriod = getShiftPeriod(startTime);

    if (!shiftPeriod || workingEmployees.length === 0) continue;

    const layoutInfo = getLayout(shiftPeriod, workingEmployees.length);
    if (!layoutInfo) continue;

    const assignments = assignEmployeesToPositions(workingEmployees, layoutInfo.positions, startTime, previousAssignments);

    // Update previous assignments for next iteration
    previousAssignments = {};
    for (const a of assignments) {
      const employeeId = a.employee.employeeId || a.employee.id || a.employee.name;
      previousAssignments[employeeId] = a.position;
    }

    // Add break flags to each assignment
    const assignmentsWithBreaks = assignments.map(a => {
      const originalAssignment = enrichedAssignments.find(
        ea => ea.employeeId === a.employee.employeeId || ea.name === a.employee.name
      );

      const breakInfo = originalAssignment
        ? calculateBreakFlags(a.employee, originalAssignment.startTime, originalAssignment.endTime)
        : { needsBreak: false, breakType: null };

      return {
        ...a,
        ...breakInfo
      };
    });

    lineups.push({
      startTime,
      endTime,
      shiftPeriod,
      peopleCount: workingEmployees.length,
      layoutUsed: layoutInfo.usedCount,
      extraPeople: layoutInfo.extraPeople,
      assignments: assignmentsWithBreaks
    });
  }

  return lineups;
}

module.exports = {
  generateLineups,
  timeToMinutes,
  minutesToTime,
  calculateBreakFlags
};
