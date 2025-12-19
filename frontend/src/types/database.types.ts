export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          best_positions: string[]
          created_at: string
          id: string
          is_minor: boolean
          name: string
          positions: string[]
          updated_at: string
        }
        Insert: {
          best_positions?: string[]
          created_at?: string
          id?: string
          is_minor?: boolean
          name: string
          positions?: string[]
          updated_at?: string
        }
        Update: {
          best_positions?: string[]
          created_at?: string
          id?: string
          is_minor?: boolean
          name?: string
          positions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      lineup_assignments: {
        Row: {
          assignment_order: number
          break_type: Database["public"]["Enums"]["break_type"] | null
          created_at: string
          employee_id: string
          id: string
          lineup_id: string
          match_quality: Database["public"]["Enums"]["match_quality"]
          needs_break: boolean
          position: string
        }
        Insert: {
          assignment_order?: number
          break_type?: Database["public"]["Enums"]["break_type"] | null
          created_at?: string
          employee_id: string
          id?: string
          lineup_id: string
          match_quality?: Database["public"]["Enums"]["match_quality"]
          needs_break?: boolean
          position: string
        }
        Update: {
          assignment_order?: number
          break_type?: Database["public"]["Enums"]["break_type"] | null
          created_at?: string
          employee_id?: string
          id?: string
          lineup_id?: string
          match_quality?: Database["public"]["Enums"]["match_quality"]
          needs_break?: boolean
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_assignments_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          created_at: string
          end_time: string
          extra_people: number
          id: string
          lineup_date: string
          people_count: number
          shift_period: Database["public"]["Enums"]["shift_period"]
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          extra_people?: number
          id?: string
          lineup_date?: string
          people_count?: number
          shift_period: Database["public"]["Enums"]["shift_period"]
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          extra_people?: number
          id?: string
          lineup_date?: string
          people_count?: number
          shift_period?: Database["public"]["Enums"]["shift_period"]
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string
          id: string
          is_shift_lead: boolean
          shift_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time: string
          id?: string
          is_shift_lead?: boolean
          shift_date?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string
          id?: string
          is_shift_lead?: boolean
          shift_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      break_type: "required" | "optional"
      match_quality: "best" | "capable" | "fallback"
      shift_period: "morning" | "lunch" | "midday" | "dinner" | "lateNight"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

// Convenience type aliases
export type Employee = Tables<"employees">
export type EmployeeInsert = TablesInsert<"employees">
export type EmployeeUpdate = TablesUpdate<"employees">

export type Shift = Tables<"shifts">
export type ShiftInsert = TablesInsert<"shifts">
export type ShiftUpdate = TablesUpdate<"shifts">

export type Lineup = Tables<"lineups">
export type LineupInsert = TablesInsert<"lineups">
export type LineupUpdate = TablesUpdate<"lineups">

export type LineupAssignment = Tables<"lineup_assignments">
export type LineupAssignmentInsert = TablesInsert<"lineup_assignments">
export type LineupAssignmentUpdate = TablesUpdate<"lineup_assignments">

export type Position = Tables<"positions">
export type PositionInsert = TablesInsert<"positions">
export type PositionUpdate = TablesUpdate<"positions">

export type ShiftPeriod = Enums<"shift_period">
export type MatchQuality = Enums<"match_quality">
export type BreakType = Enums<"break_type">
