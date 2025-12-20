/**
 * Time period definitions for position filtering
 */
const TIME_PERIOD_RANGES = {
  morning: { start: 360, end: 630 },     // 6:00 - 10:30
  lunch: { start: 630, end: 840 },       // 10:30 - 14:00
  midday: { start: 840, end: 1020 },     // 14:00 - 17:00
  dinner: { start: 1020, end: 1200 },    // 17:00 - 20:00
  lateNight: { start: 1200, end: 1320 }  // 20:00 - 22:00
};

/**
 * Get the shift period based on time
 */
function getShiftPeriod(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;

  if (timeInMinutes >= 360 && timeInMinutes < 630) return 'morning';
  if (timeInMinutes >= 630 && timeInMinutes < 840) return 'lunch';
  if (timeInMinutes >= 840 && timeInMinutes < 1020) return 'midday';
  if (timeInMinutes >= 1020 && timeInMinutes < 1200) return 'dinner';
  if (timeInMinutes >= 1200 && timeInMinutes < 1320) return 'lateNight';

  return null;
}

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
 * Default position priorities - lower number = higher priority (fill first)
 * Used as fallback if positions don't have priorities set
 */
const defaultPositionPriorities = {
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
 * Filter positions by time period
 * Positions with 'all' in timePeriods are always included
 */
function filterPositionsByTimePeriod(positions, shiftPeriod) {
  return positions.filter(pos => {
    const timePeriods = pos.timePeriods || ['all'];
    return timePeriods.includes('all') || timePeriods.includes(shiftPeriod);
  });
}

/**
 * Get positions for lineup generation, sorted by priority
 * Uses database positions if available, falls back to default priorities
 */
function getPositionsForPeriod(dbPositions, shiftPeriod, peopleCount) {
  if (!dbPositions || dbPositions.length === 0) {
    // Fallback to using default priorities - shouldn't happen in normal use
    return null;
  }

  // Filter positions by time period
  const filteredPositions = filterPositionsByTimePeriod(dbPositions, shiftPeriod);

  // Sort by priority (lower = higher priority = fill first)
  const sortedPositions = filteredPositions.sort((a, b) => {
    const priorityA = a.priority || 99;
    const priorityB = b.priority || 99;
    return priorityA - priorityB;
  });

  // Take only as many positions as we have people (minus leaders/boosters/trainees)
  // We'll fill all positions and extras become support
  const positionNames = sortedPositions.map(p => p.name);

  return {
    positions: positionNames,
    positionData: sortedPositions  // Keep full data for priority lookup
  };
}

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
 * positionPriorityMap: optional map of position name to priority from database
 */
function getPositionPriority(position, positionPriorityMap = null) {
  const options = position.split('/');
  let highestPriority = 99;

  for (const opt of options) {
    // First check the dynamic priority map from database
    let priority = positionPriorityMap?.[opt];
    // Fall back to defaults if not in map
    if (priority === undefined) {
      priority = defaultPositionPriorities[opt] || 99;
    }
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
 * Boosters float to help everyone, trainees shadow and aren't locked to positions
 * previousAssignments helps minimize position changes between periods
 * positionPriorityMap: map of position name -> priority from database
 */
function assignEmployeesToPositions(workingEmployees, positions, startTime, previousAssignments = {}, positionPriorityMap = null) {
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

  // Handle shift leads first - uses isShiftLead flag set per shift
  // Multiple shift leads are allowed
  const leadIndices = [];
  for (let i = unassigned.length - 1; i >= 0; i--) {
    if (unassigned[i].isShiftLead === true) {
      leadIndices.push(i);
    }
  }

  // Process in reverse order to maintain correct indices during splice
  for (const leadIndex of leadIndices) {
    const leadEmployee = unassigned[leadIndex];
    unassigned.splice(leadIndex, 1);

    assignments.push({
      employee: leadEmployee,
      position: 'lead (floating)',
      matchQuality: 'best'
    });
  }

  // Handle boosters - they float to help everyone
  const boosterIndices = [];
  for (let i = unassigned.length - 1; i >= 0; i--) {
    if (unassigned[i].isBooster === true) {
      boosterIndices.push(i);
    }
  }

  for (const boosterIndex of boosterIndices) {
    const boosterEmployee = unassigned[boosterIndex];
    unassigned.splice(boosterIndex, 1);

    assignments.push({
      employee: boosterEmployee,
      position: 'booster (floating)',
      matchQuality: 'best'
    });
  }

  // Handle trainees - they shadow and aren't locked to positions
  const traineeIndices = [];
  for (let i = unassigned.length - 1; i >= 0; i--) {
    if (unassigned[i].isInTraining === true) {
      traineeIndices.push(i);
    }
  }

  for (const traineeIndex of traineeIndices) {
    const traineeEmployee = unassigned[traineeIndex];
    unassigned.splice(traineeIndex, 1);

    assignments.push({
      employee: traineeEmployee,
      position: 'in training',
      matchQuality: 'training'
    });
  }

  // Sort positions by priority (lower number = higher priority = fill first)
  // Lead floats so all positions need to be filled
  const positionsToFill = filteredPositions;

  const sortedPositions = [...positionsToFill].map(pos => ({
    position: pos,
    priority: getPositionPriority(pos, positionPriorityMap)
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

  // Optimization pass: swap fallback/capable assignments with better matches
  // This ensures the best possible lineup by allowing "best" employees to take
  // positions from "fallback" or "capable" employees
  let improved = true;
  while (improved) {
    improved = false;

    for (let i = 0; i < assignments.length; i++) {
      const currentAssignment = assignments[i];

      // Skip lead positions and extra/support
      if (currentAssignment.position.includes('lead') ||
          currentAssignment.position === 'extra/support') {
        continue;
      }

      // Only try to improve fallback or capable assignments
      if (currentAssignment.matchQuality !== 'fallback' &&
          currentAssignment.matchQuality !== 'capable') {
        continue;
      }

      // Look for a better employee currently in a lower-quality match or extra/support
      for (let j = 0; j < assignments.length; j++) {
        if (i === j) continue;

        const otherAssignment = assignments[j];

        // Skip lead positions
        if (otherAssignment.position.includes('lead')) continue;

        // Check if the other employee would be "best" at current position
        const otherEmployeeScore = scoreEmployeeForPosition(
          otherAssignment.employee,
          currentAssignment.position,
          false,
          null
        );

        // Other employee is "best" at this position (score >= 10)
        if (otherEmployeeScore >= 10) {
          // Check if current employee can work the other position
          const currentEmployeeScoreAtOther = otherAssignment.position === 'extra/support'
            ? 0
            : scoreEmployeeForPosition(
                currentAssignment.employee,
                otherAssignment.position,
                false,
                null
              );

          // Swap is beneficial if:
          // 1. Other position is extra/support (we're pulling someone up)
          // 2. Current employee can work the other position
          const shouldSwap = otherAssignment.position === 'extra/support' ||
            currentEmployeeScoreAtOther > 0;

          if (shouldSwap) {
            // Store references to employees before swapping
            const currentEmployee = currentAssignment.employee;
            const otherEmployee = otherAssignment.employee;

            // Move "best" employee to this position
            currentAssignment.employee = otherEmployee;
            currentAssignment.matchQuality = 'best';

            // Move displaced employee to the other position
            otherAssignment.employee = currentEmployee;
            if (otherAssignment.position === 'extra/support') {
              otherAssignment.matchQuality = 'extra';
            } else {
              otherAssignment.matchQuality = currentEmployeeScoreAtOther >= 10
                ? 'best'
                : currentEmployeeScoreAtOther >= 5
                  ? 'capable'
                  : 'fallback';
            }

            improved = true;
            break;
          }
        }
      }

      if (improved) break;
    }
  }

  // Re-sort assignments to match original position order for display
  const positionOrder = {};
  positionOrder['lead (floating)'] = -3;       // Leads show first
  positionOrder['booster (floating)'] = -2;    // Boosters show second
  positionOrder['in training'] = -1;           // Trainees show third
  positionOrder['buns (lead)'] = -1;           // Lead on buns shows first
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
 * @param shiftAssignments - employees and their shift times
 * @param employees - full employee data with positions/bestPositions
 * @param dbPositions - positions from database with priorities and time periods
 */
function generateLineups(shiftAssignments, employees, dbPositions = null) {
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

  // Build priority map from database positions
  const positionPriorityMap = {};
  if (dbPositions && dbPositions.length > 0) {
    for (const pos of dbPositions) {
      positionPriorityMap[pos.name] = pos.priority || 99;
    }
  }

  for (let i = 0; i < changePoints.length - 1; i++) {
    const startMinutes = changePoints[i];
    const endMinutes = changePoints[i + 1];
    const startTime = minutesToTime(startMinutes);
    const endTime = minutesToTime(endMinutes);

    const workingEmployees = getWorkingEmployees(enrichedAssignments, startMinutes);
    const shiftPeriod = getShiftPeriod(startTime);

    if (!shiftPeriod || workingEmployees.length === 0) continue;

    // Get positions filtered by time period and sorted by priority
    let positionsToUse;
    if (dbPositions && dbPositions.length > 0) {
      const periodPositions = getPositionsForPeriod(dbPositions, shiftPeriod, workingEmployees.length);
      if (periodPositions) {
        positionsToUse = periodPositions.positions;
      }
    }

    // If no database positions, skip this period (user needs to add positions)
    if (!positionsToUse || positionsToUse.length === 0) {
      console.warn(`No positions found for period ${shiftPeriod}, skipping lineup generation`);
      continue;
    }

    const assignments = assignEmployeesToPositions(workingEmployees, positionsToUse, startTime, previousAssignments, positionPriorityMap);

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
      positionsUsed: positionsToUse.length,
      extraPeople: Math.max(0, workingEmployees.length - positionsToUse.length),
      assignments: assignmentsWithBreaks
    });
  }

  // Generate closing lineup based on the last lineup period
  const closingLineup = generateClosingLineup(lineups, enrichedAssignments);

  return { lineups, closingLineup };
}

/**
 * Generate closing lineup assignments
 * Closing positions: breading, machines, primary, secondary
 * People stay in their current position if it's a closing position
 * Others are listed separately as "available"
 */
function generateClosingLineup(lineups, enrichedAssignments) {
  if (lineups.length === 0) return null;

  // Get the last lineup of the day
  const lastLineup = lineups[lineups.length - 1];

  // Find employees who are closing (working until the end)
  const lastEndTime = lastLineup.endTime;
  const closingEmployeeIds = new Set(
    enrichedAssignments
      .filter(emp => emp.endTime === lastEndTime)
      .map(emp => emp.employeeId || emp.id || emp.name)
  );

  if (closingEmployeeIds.size === 0) return null;

  const closingAssignments = [];
  const availableEmployees = [];
  const assignedIds = new Set();

  // Go through the last lineup and keep closers in their positions
  for (const assignment of lastLineup.assignments) {
    const empId = assignment.employee.employeeId || assignment.employee.id || assignment.employee.name;

    // Skip if this employee isn't closing
    if (!closingEmployeeIds.has(empId)) continue;

    // Check if their current position is a closing position
    const currentPosition = assignment.position.toLowerCase().replace(' (floating)', '').replace(' (lead)', '');

    // Map position to closing position name
    let closingPosition = null;
    if (currentPosition === 'breading' || currentPosition === 'breader') {
      closingPosition = 'breading';
    } else if (currentPosition === 'machines') {
      closingPosition = 'machines';
    } else if (currentPosition === 'primary') {
      closingPosition = 'primary';
    } else if (currentPosition === 'secondary1' || currentPosition === 'secondary') {
      closingPosition = 'secondary';
    } else if (currentPosition.includes('lead') || assignment.employee.isShiftLead) {
      closingPosition = 'team member';
    }

    if (closingPosition) {
      closingAssignments.push({
        employee: assignment.employee,
        position: closingPosition,
        matchQuality: 'best'
      });
      assignedIds.add(empId);
    }
  }

  // Find closers who don't have a closing task
  for (const assignment of lastLineup.assignments) {
    const empId = assignment.employee.employeeId || assignment.employee.id || assignment.employee.name;

    if (closingEmployeeIds.has(empId) && !assignedIds.has(empId)) {
      availableEmployees.push({
        employee: assignment.employee,
        position: 'available',
        matchQuality: 'extra'
      });
    }
  }

  // Sort by position priority for display
  const positionOrder = ['breading', 'machines', 'primary', 'secondary', 'team member'];
  closingAssignments.sort((a, b) => {
    return positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position);
  });

  // Add available employees at the end
  closingAssignments.push(...availableEmployees);

  return {
    title: 'Closing',
    assignments: closingAssignments,
    peopleCount: closingAssignments.length
  };
}

module.exports = {
  generateLineups,
  timeToMinutes,
  minutesToTime,
  calculateBreakFlags
};
