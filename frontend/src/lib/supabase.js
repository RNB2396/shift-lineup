import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging - remove after fixing
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key (first 20 chars):', supabaseAnonKey?.substring(0, 20));
console.log('Supabase Key length:', supabaseAnonKey?.length);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Some features may not work.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper functions for lineup operations
export const lineupService = {
  // Save a lineup to the database
  async saveLineup(lineup) {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: lineupData, error: lineupError } = await supabase
      .from('lineups')
      .insert({
        lineup_date: lineup.date || new Date().toISOString().split('T')[0],
        start_time: lineup.startTime,
        end_time: lineup.endTime,
        shift_period: lineup.shiftPeriod,
        people_count: lineup.peopleCount,
        extra_people: lineup.extraPeople || 0
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

  // Save multiple lineups at once
  async saveAllLineups(lineups, date) {
    if (!supabase) throw new Error('Supabase not configured');

    const savedLineups = [];
    for (const lineup of lineups) {
      const saved = await this.saveLineup({ ...lineup, date });
      savedLineups.push(saved);
    }
    return savedLineups;
  },

  // Get all saved lineups for a date
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
      .order('start_time');

    if (error) throw error;
    return data.map(this.transformLineup);
  },

  // Get all saved lineups (grouped by date)
  async getAllLineups() {
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
      .eq('lineup_date', date);

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
