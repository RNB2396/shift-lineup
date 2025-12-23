import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Some features may not work.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Store ID for multi-tenant operations
let currentStoreId = null;

export const setLineupStoreId = (storeId) => {
  currentStoreId = storeId;
};

// Helper functions for lineup operations
export const lineupService = {
  // Save a lineup to the database
  async saveLineup(lineup, houseType = 'boh') {
    if (!supabase) throw new Error('Supabase not configured');
    if (!currentStoreId) throw new Error('No store selected');

    const { data: lineupData, error: lineupError } = await supabase
      .from('lineups')
      .insert({
        lineup_date: lineup.date || new Date().toISOString().split('T')[0],
        start_time: lineup.startTime,
        end_time: lineup.endTime,
        shift_period: lineup.shiftPeriod,
        people_count: lineup.peopleCount,
        extra_people: lineup.extraPeople || 0,
        store_id: currentStoreId,
        house_type: houseType
      })
      .select()
      .single();

    if (lineupError) throw lineupError;

    // Save assignments
    if (lineup.assignments && lineup.assignments.length > 0) {
      const assignments = lineup.assignments.map((a, index) => ({
        lineup_id: lineupData.id,
        employee_id: a.employee.id,
        position: a.position,
        match_quality: a.matchQuality,
        needs_break: a.needsBreak || false,
        break_type: a.breakType || null,
        assignment_order: index
      }));

      const { error: assignmentError } = await supabase
        .from('lineup_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;
    }

    return lineupData;
  },

  // Save multiple lineups at once (including closing lineup)
  async saveAllLineups(lineups, date, closingLineup = null, houseType = 'boh') {
    if (!supabase) throw new Error('Supabase not configured');

    const savedLineups = [];
    for (const lineup of lineups) {
      const saved = await this.saveLineup({ ...lineup, date }, houseType);
      savedLineups.push(saved);
    }

    // Save closing lineup if provided
    if (closingLineup && closingLineup.assignments && closingLineup.assignments.length > 0) {
      const closingData = {
        ...closingLineup,
        date,
        startTime: '22:00',
        endTime: '22:00',
        shiftPeriod: 'closing',
        peopleCount: closingLineup.peopleCount || closingLineup.assignments.length,
        extraPeople: 0
      };
      const savedClosing = await this.saveLineup(closingData, houseType);
      savedLineups.push(savedClosing);
    }

    return savedLineups;
  },

  // Get all saved lineups for a date (filtered by store via RLS)
  async getLineupsByDate(date) {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('lineups')
      .select(`
        *,
        lineup_assignments (
          *,
          employees (*)
        )
      `)
      .eq('lineup_date', date)
      .eq('store_id', currentStoreId)
      .order('start_time');

    if (error) throw error;
    return data.map(this.transformLineup);
  },

  // Get all saved lineups (grouped by date, filtered by store)
  async getAllLineups() {
    if (!supabase) throw new Error('Supabase not configured');
    if (!currentStoreId) return [];

    const { data, error } = await supabase
      .from('lineups')
      .select(`
        *,
        lineup_assignments (
          *,
          employees (*)
        )
      `)
      .eq('store_id', currentStoreId)
      .order('lineup_date', { ascending: false })
      .order('start_time');

    if (error) throw error;
    return data.map(this.transformLineup);
  },

  // Update an assignment (for drag and drop)
  async updateAssignment(assignmentId, updates) {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('lineup_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Swap two assignments
  async swapAssignments(assignment1Id, assignment2Id) {
    if (!supabase) throw new Error('Supabase not configured');

    // Get both assignments
    const { data: assignments, error: fetchError } = await supabase
      .from('lineup_assignments')
      .select('*')
      .in('id', [assignment1Id, assignment2Id]);

    if (fetchError) throw fetchError;
    if (assignments.length !== 2) throw new Error('Assignments not found');

    const [a1, a2] = assignments;

    // Swap positions
    const { error: update1Error } = await supabase
      .from('lineup_assignments')
      .update({ position: a2.position, assignment_order: a2.assignment_order })
      .eq('id', a1.id);

    if (update1Error) throw update1Error;

    const { error: update2Error } = await supabase
      .from('lineup_assignments')
      .update({ position: a1.position, assignment_order: a1.assignment_order })
      .eq('id', a2.id);

    if (update2Error) throw update2Error;

    return true;
  },

  // Swap two assignments and cascade to all subsequent lineups for the same day
  async swapAssignmentsWithCascade(assignment1Id, assignment2Id, lineupId, allLineups) {
    if (!supabase) throw new Error('Supabase not configured');

    // Get both assignments with their employee IDs
    const { data: assignments, error: fetchError } = await supabase
      .from('lineup_assignments')
      .select('*, lineup_id')
      .in('id', [assignment1Id, assignment2Id]);

    if (fetchError) throw fetchError;
    if (assignments.length !== 2) throw new Error('Assignments not found');

    const [a1, a2] = assignments;
    const employee1Id = a1.employee_id;
    const employee2Id = a2.employee_id;
    const position1 = a1.position;
    const position2 = a2.position;

    // Get the current lineup to find its start time
    const currentLineup = allLineups.find(l => l.id === lineupId);
    if (!currentLineup) throw new Error('Current lineup not found');

    // Find all lineups for the same date that come after this one (by start time)
    const laterLineups = allLineups.filter(l =>
      l.date === currentLineup.date &&
      l.startTime > currentLineup.startTime &&
      l.shiftPeriod !== 'closing'
    );

    // Collect all assignment IDs to update
    const updatesToPosition1 = [a2.id]; // a2 gets position1
    const updatesToPosition2 = [a1.id]; // a1 gets position2

    // For each later lineup, find if these employees are there and need swapping
    for (const laterLineup of laterLineups) {
      const emp1Assignment = laterLineup.assignments.find(a => a.employee?.id === employee1Id);
      const emp2Assignment = laterLineup.assignments.find(a => a.employee?.id === employee2Id);

      // If employee1 is in position1, move them to position2
      if (emp1Assignment && emp1Assignment.position === position1) {
        updatesToPosition2.push(emp1Assignment.id);
      }
      // If employee2 is in position2, move them to position1
      if (emp2Assignment && emp2Assignment.position === position2) {
        updatesToPosition1.push(emp2Assignment.id);
      }
    }

    // Perform the updates
    if (updatesToPosition1.length > 0) {
      const { error } = await supabase
        .from('lineup_assignments')
        .update({ position: position1 })
        .in('id', updatesToPosition1);
      if (error) throw error;
    }

    if (updatesToPosition2.length > 0) {
      const { error } = await supabase
        .from('lineup_assignments')
        .update({ position: position2 })
        .in('id', updatesToPosition2);
      if (error) throw error;
    }

    return {
      updatesToPosition1,
      updatesToPosition2,
      position1,
      position2,
      employee1Id,
      employee2Id
    };
  },

  // Delete a lineup
  async deleteLineup(lineupId) {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('lineups')
      .delete()
      .eq('id', lineupId);

    if (error) throw error;
    return true;
  },

  // Delete all lineups for a date
  async deleteLineupsByDate(date) {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('lineups')
      .delete()
      .eq('lineup_date', date)
      .eq('store_id', currentStoreId);

    if (error) throw error;
    return true;
  },

  // Transform database format to frontend format
  transformLineup(dbLineup) {
    return {
      id: dbLineup.id,
      date: dbLineup.lineup_date,
      startTime: dbLineup.start_time,
      endTime: dbLineup.end_time,
      shiftPeriod: dbLineup.shift_period,
      peopleCount: dbLineup.people_count,
      extraPeople: dbLineup.extra_people,
      storeId: dbLineup.store_id,
      houseType: dbLineup.house_type || 'boh',
      assignments: (dbLineup.lineup_assignments || [])
        .sort((a, b) => a.assignment_order - b.assignment_order)
        .map(a => ({
          id: a.id,
          position: a.position,
          matchQuality: a.match_quality,
          needsBreak: a.needs_break,
          breakType: a.break_type,
          employee: a.employees ? {
            id: a.employees.id,
            name: a.employees.name,
            isMinor: a.employees.is_minor,
            positions: a.employees.positions,
            bestPositions: a.employees.best_positions
          } : null
        }))
    };
  }
};

export default supabase;
