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

  // Optimization pass: find swaps that increase total "best" matches
  // This handles cases like:
  // - Dakota: best at secondary AND primary
  // - Anele: best at secondary only
  // Greedy assigns Dakota->secondary (best), Anele->primary (capable)
  // But swapping gives Dakota->primary (best), Anele->secondary (best) = better!
  let improved = true;
  let iterations = 0;
  const maxIterations = 100; // Safety limit to prevent infinite loops

  while (improved && iterations < maxIterations) {
    iterations++;
    improved = false;

    // Try all pairs of assignments to find beneficial swaps
    for (let i = 0; i < assignments.length; i++) {
      const assignmentA = assignments[i];

      // Skip special positions
      if (assignmentA.position.includes('lead') ||
          assignmentA.position.includes('booster') ||
          assignmentA.position === 'in training' ||
          assignmentA.position === 'extra/support') {
        continue;
      }

      for (let j = i + 1; j < assignments.length; j++) {
        const assignmentB = assignments[j];

        // Skip special positions
        if (assignmentB.position.includes('lead') ||
            assignmentB.position.includes('booster') ||
            assignmentB.position === 'in training' ||
            assignmentB.position === 'extra/support') {
          continue;
        }

        // Calculate current scores
        const scoreAatA = scoreEmployeeForPosition(assignmentA.employee, assignmentA.position, false, null);
        const scoreBatB = scoreEmployeeForPosition(assignmentB.employee, assignmentB.position, false, null);
        const currentTotal = scoreAatA + scoreBatB;

        // Calculate swapped scores
        const scoreAatB = scoreEmployeeForPosition(assignmentA.employee, assignmentB.position, false, null);
        const scoreBatA = scoreEmployeeForPosition(assignmentB.employee, assignmentA.position, false, null);
        const swappedTotal = scoreAatB + scoreBatA;

        // Count "best" matches (score >= 10) before and after
        const currentBestCount = (scoreAatA >= 10 ? 1 : 0) + (scoreBatB >= 10 ? 1 : 0);
        const swappedBestCount = (scoreAatB >= 10 ? 1 : 0) + (scoreBatA >= 10 ? 1 : 0);

        // Swap if it increases the number of "best" matches
        // Or if same number of "best" but higher total score
        const shouldSwap = swappedBestCount > currentBestCount ||
          (swappedBestCount === currentBestCount && swappedTotal > currentTotal);

        if (shouldSwap) {
          // Perform the swap
          const tempEmployee = assignmentA.employee;
          assignmentA.employee = assignmentB.employee;
          assignmentB.employee = tempEmployee;

          // Update match qualities
          assignmentA.matchQuality = scoreBatA >= 10 ? 'best' : scoreBatA >= 5 ? 'capable' : 'fallback';
          assignmentB.matchQuality = scoreAatB >= 10 ? 'best' : scoreAatB >= 5 ? 'capable' : 'fallback';

          improved = true;
          break;
        }
      }

      if (improved) break;
    }
  }

  // Second pass: pull people from extra/support if they're "best" at an unfilled position
  improved = true;
  iterations = 0;
  while (improved && iterations < maxIterations) {
    iterations++;
    improved = false;

    for (let i = 0; i < assignments.length; i++) {
      const currentAssignment = assignments[i];

      // Only try to improve non-best regular positions
      if (currentAssignment.position.includes('lead') ||
          currentAssignment.position.includes('booster') ||
          currentAssignment.position === 'in training' ||
          currentAssignment.position === 'extra/support' ||
          currentAssignment.matchQuality === 'best') {
        continue;
      }

      // Look for someone in extra/support who is "best" at this position
      for (let j = 0; j < assignments.length; j++) {
        if (i === j) continue;

        const otherAssignment = assignments[j];
        if (otherAssignment.position !== 'extra/support') continue;

        const otherEmployeeScore = scoreEmployeeForPosition(
          otherAssignment.employee,
          currentAssignment.position,
          false,
          null
        );

        if (otherEmployeeScore >= 10) {
          // Swap: bring the "best" person up from extra/support
          const tempEmployee = currentAssignment.employee;
          currentAssignment.employee = otherAssignment.employee;
          otherAssignment.employee = tempEmployee;

          currentAssignment.matchQuality = 'best';
          otherAssignment.matchQuality = 'extra';

          improved = true;
          break;
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
  const closingLineup = generateClosingLineup(lineups, enrichedAssignments, dbPositions);

  return { lineups, closingLineup };
}

/**
 * Generate closing lineup assignments
 * Uses positions marked with requiresClosing from the database
 * Assigns closers to positions based on best match
 */
function generateClosingLineup(lineups, enrichedAssignments, dbPositions = []) {
  if (lineups.length === 0) {
    console.log('[Closing] No lineups generated, skipping closing lineup');
    return null;
  }

  // Get the last lineup of the day
  const lastLineup = lineups[lineups.length - 1];

  // Find employees who are closing (working until the end)
  const lastEndTime = lastLineup.endTime;

  console.log('[Closing] Last lineup endTime:', lastEndTime);
  console.log('[Closing] All employee endTimes:', enrichedAssignments.map(e => ({ name: e.name, endTime: e.endTime })));

  const closingEmployees = enrichedAssignments.filter(emp => emp.endTime === lastEndTime);

  console.log('[Closing] Employees matching lastEndTime:', closingEmployees.map(e => e.name));

  if (closingEmployees.length === 0) {
    console.log('[Closing] No employees working until end, skipping closing lineup');
    return null;
  }

  // Get closing positions from database (positions with requiresClosing = true)
  const closingPositions = dbPositions
    .filter(pos => pos.requiresClosing)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    .map(pos => pos.name);

  console.log('[Closing] Closing positions from DB:', closingPositions);

  // If no closing positions defined, return null (no closing lineup)
  if (closingPositions.length === 0) {
    console.log('[Closing] No closing positions defined in database');
    return null;
  }

  const closingAssignments = [];
  const assignedEmployeeIds = new Set();
  const unassignedClosers = [...closingEmployees];

  // Build a map of employee's current position from the last lineup
  const employeeCurrentPositions = {};
  for (const assignment of lastLineup.assignments) {
    const empId = assignment.employee.employeeId || assignment.employee.id || assignment.employee.name;
    employeeCurrentPositions[empId] = assignment.position.toLowerCase().replace(' (floating)', '').replace(' (lead)', '');
  }

  // For each closing position, find the best employee
  for (const position of closingPositions) {
    let bestEmployee = null;
    let bestScore = -1;
    let bestIndex = -1;
    const positionLower = position.toLowerCase();

    for (let i = 0; i < unassignedClosers.length; i++) {
      const employee = unassignedClosers[i];
      const empId = employee.employeeId || employee.id || employee.name;
      const currentPos = employeeCurrentPositions[empId] || '';

      let score = 0;

      // Big bonus if already in this position
      if (currentPos === positionLower || currentPos.includes(positionLower)) {
        score += 50;
      }

      // Best position skill
      if (employee.bestPositions && employee.bestPositions.some(p => p.toLowerCase() === positionLower)) {
        score += 10;
      }
      // Can do position skill
      else if (employee.positions && employee.positions.some(p => p.toLowerCase() === positionLower)) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestEmployee = employee;
        bestIndex = i;
      }
    }

    if (bestEmployee) {
      const empId = bestEmployee.employeeId || bestEmployee.id || bestEmployee.name;
      closingAssignments.push({
        employee: bestEmployee,
        position: position,
        matchQuality: bestScore >= 50 ? 'best' : bestScore >= 5 ? 'capable' : 'fallback'
      });
      assignedEmployeeIds.add(empId);
      unassignedClosers.splice(bestIndex, 1);
    }
  }

  // Any remaining closers become available
  for (const employee of unassignedClosers) {
    closingAssignments.push({
      employee: employee,
      position: 'available',
      matchQuality: 'extra'
    });
  }

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
