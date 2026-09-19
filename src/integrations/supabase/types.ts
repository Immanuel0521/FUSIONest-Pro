export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_dependencies: {
        Row: {
          activity_type_id: string
          created_at: string
          id: string
          prerequisite_activity_type_id: string
          project_id: string | null
        }
        Insert: {
          activity_type_id: string
          created_at?: string
          id?: string
          prerequisite_activity_type_id: string
          project_id?: string | null
        }
        Update: {
          activity_type_id?: string
          created_at?: string
          id?: string
          prerequisite_activity_type_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_dependencies_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_dependencies_prerequisite_activity_type_id_fkey"
            columns: ["prerequisite_activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          daily_activity_id: string | null
          id: string
          photo_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          daily_activity_id?: string | null
          id?: string
          photo_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          daily_activity_id?: string | null
          id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_photos_daily_activity_id_fkey"
            columns: ["daily_activity_id"]
            isOneToOne: false
            referencedRelation: "daily_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_custom: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_custom?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_custom?: boolean | null
          name?: string
        }
        Relationships: []
      }
      activity_workers: {
        Row: {
          created_at: string | null
          daily_activity_id: string | null
          department: Database["public"]["Enums"]["worker_department"]
          guest_worker_name: string | null
          hours_worked: number | null
          id: string
          ot_hours: number | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          daily_activity_id?: string | null
          department: Database["public"]["Enums"]["worker_department"]
          guest_worker_name?: string | null
          hours_worked?: number | null
          id?: string
          ot_hours?: number | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          daily_activity_id?: string | null
          department?: Database["public"]["Enums"]["worker_department"]
          guest_worker_name?: string | null
          hours_worked?: number | null
          id?: string
          ot_hours?: number | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_workers_daily_activity_id_fkey"
            columns: ["daily_activity_id"]
            isOneToOne: false
            referencedRelation: "daily_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          attendance_log_id: string | null
          before_data: Json | null
          created_at: string
          id: string
          reason: string | null
          worker_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          attendance_log_id?: string | null
          before_data?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          worker_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          attendance_log_id?: string | null
          before_data?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_logs_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_audit_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "attendance_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_group_members_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_groups: {
        Row: {
          active: boolean
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          checkin_source: string | null
          checkout_source: string | null
          created_at: string
          date: string
          early_exit: boolean | null
          face_confidence_in: number | null
          face_confidence_out: number | null
          face_verified_in: boolean | null
          face_verified_out: boolean | null
          group_id: string | null
          id: string
          is_late: boolean
          late_minutes: number | null
          location_in: Json | null
          location_out: Json | null
          marked_by: string | null
          notes: string | null
          notes_in: string | null
          notes_out: string | null
          overtime_hours: number | null
          recorded_by: string | null
          regular_hours: number
          shift_end: string
          shift_start: string
          site_id: string | null
          status: string
          supervisor_id: string
          time_in: string
          time_out: string | null
          total_hours: number | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          checkin_source?: string | null
          checkout_source?: string | null
          created_at?: string
          date?: string
          early_exit?: boolean | null
          face_confidence_in?: number | null
          face_confidence_out?: number | null
          face_verified_in?: boolean | null
          face_verified_out?: boolean | null
          group_id?: string | null
          id?: string
          is_late?: boolean
          late_minutes?: number | null
          location_in?: Json | null
          location_out?: Json | null
          marked_by?: string | null
          notes?: string | null
          notes_in?: string | null
          notes_out?: string | null
          overtime_hours?: number | null
          recorded_by?: string | null
          regular_hours?: number
          shift_end?: string
          shift_start?: string
          site_id?: string | null
          status?: string
          supervisor_id: string
          time_in?: string
          time_out?: string | null
          total_hours?: number | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          checkin_source?: string | null
          checkout_source?: string | null
          created_at?: string
          date?: string
          early_exit?: boolean | null
          face_confidence_in?: number | null
          face_confidence_out?: number | null
          face_verified_in?: boolean | null
          face_verified_out?: boolean | null
          group_id?: string | null
          id?: string
          is_late?: boolean
          late_minutes?: number | null
          location_in?: Json | null
          location_out?: Json | null
          marked_by?: string | null
          notes?: string | null
          notes_in?: string | null
          notes_out?: string | null
          overtime_hours?: number | null
          recorded_by?: string | null
          regular_hours?: number
          shift_end?: string
          shift_start?: string
          site_id?: string | null
          status?: string
          supervisor_id?: string
          time_in?: string
          time_out?: string | null
          total_hours?: number | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "worker_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_photos: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          attendance_id: string | null
          created_at: string
          date: string
          id: string
          photo_type: string
          photo_url: string
          worker_id: string
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_id?: string | null
          created_at?: string
          date?: string
          id?: string
          photo_type?: string
          photo_url: string
          worker_id: string
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_id?: string | null
          created_at?: string
          date?: string
          id?: string
          photo_type?: string
          photo_url?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_photos_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_photos_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          created_at: string
          dropdown_options: Json | null
          help_text: string | null
          id: string
          input_type: Database["public"]["Enums"]["checklist_input_type"]
          is_required: boolean
          item_number: number
          item_text: string
          template_id: string
        }
        Insert: {
          created_at?: string
          dropdown_options?: Json | null
          help_text?: string | null
          id?: string
          input_type: Database["public"]["Enums"]["checklist_input_type"]
          is_required?: boolean
          item_number: number
          item_text: string
          template_id: string
        }
        Update: {
          created_at?: string
          dropdown_options?: Json | null
          help_text?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["checklist_input_type"]
          is_required?: boolean
          item_number?: number
          item_text?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          id: string
          item_id: string
          project_checklist_id: string
          response_date: string
          response_photos: Json | null
          response_signature: string | null
          response_value: string | null
        }
        Insert: {
          id?: string
          item_id: string
          project_checklist_id: string
          response_date?: string
          response_photos?: Json | null
          response_signature?: string | null
          response_value?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          project_checklist_id?: string
          response_date?: string
          response_photos?: Json | null
          response_signature?: string | null
          response_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_project_checklist_id_fkey"
            columns: ["project_checklist_id"]
            isOneToOne: false
            referencedRelation: "project_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          category: string | null
          checklist_type: Database["public"]["Enums"]["checklist_type"]
          created_at: string
          created_by: string
          description: string | null
          id: string
          pdf_path: string | null
          stage: Database["public"]["Enums"]["checklist_stage"] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          checklist_type: Database["public"]["Enums"]["checklist_type"]
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          pdf_path?: string | null
          stage?: Database["public"]["Enums"]["checklist_stage"] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          checklist_type?: Database["public"]["Enums"]["checklist_type"]
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          pdf_path?: string | null
          stage?: Database["public"]["Enums"]["checklist_stage"] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_activities: {
        Row: {
          activity_type_id: string | null
          created_at: string | null
          custom_activity_name: string | null
          date: string
          description: string | null
          equipment_used: string | null
          estimated_finish_date: string | null
          hours_worked: number | null
          id: string
          issues_faced: string | null
          materials_used: string | null
          notes: string | null
          progress_percentage: number | null
          project_id: string | null
          supervisor_id: string
          updated_at: string | null
          weather_conditions: string | null
        }
        Insert: {
          activity_type_id?: string | null
          created_at?: string | null
          custom_activity_name?: string | null
          date?: string
          description?: string | null
          equipment_used?: string | null
          estimated_finish_date?: string | null
          hours_worked?: number | null
          id?: string
          issues_faced?: string | null
          materials_used?: string | null
          notes?: string | null
          progress_percentage?: number | null
          project_id?: string | null
          supervisor_id: string
          updated_at?: string | null
          weather_conditions?: string | null
        }
        Update: {
          activity_type_id?: string | null
          created_at?: string | null
          custom_activity_name?: string | null
          date?: string
          description?: string | null
          equipment_used?: string | null
          estimated_finish_date?: string | null
          hours_worked?: number | null
          id?: string
          issues_faced?: string | null
          materials_used?: string | null
          notes?: string | null
          progress_percentage?: number | null
          project_id?: string | null
          supervisor_id?: string
          updated_at?: string | null
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_activities_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_work_notes: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location: string | null
          monitored_by: string | null
          note: string
          supervisor_id: string
          updated_at: string | null
          worker_ids: string[] | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          location?: string | null
          monitored_by?: string | null
          note: string
          supervisor_id: string
          updated_at?: string | null
          worker_ids?: string[] | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          location?: string | null
          monitored_by?: string | null
          note?: string
          supervisor_id?: string
          updated_at?: string | null
          worker_ids?: string[] | null
        }
        Relationships: []
      }
      deployments: {
        Row: {
          created_at: string
          created_by: string | null
          deployment_date: string
          group_id: string
          id: string
          notes: string | null
          project_id: string
          site_id: string
          updated_at: string
          worker_ids: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deployment_date?: string
          group_id: string
          id?: string
          notes?: string | null
          project_id: string
          site_id: string
          updated_at?: string
          worker_ids?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deployment_date?: string
          group_id?: string
          id?: string
          notes?: string | null
          project_id?: string
          site_id?: string
          updated_at?: string
          worker_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "deployments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "worker_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_activities: {
        Row: {
          activity_name: string | null
          activity_type_id: string | null
          completed_qty: number
          created_at: string
          cumulative_after: number | null
          cumulative_before: number | null
          dpr_id: string
          id: string
          location: string | null
          planned_qty: number
          reason_not_achieved: string | null
          remarks: string | null
          stage: string | null
          status: Database["public"]["Enums"]["dpr_activity_status"]
          target_reached: boolean | null
          total_project_qty: number | null
          unit: string | null
        }
        Insert: {
          activity_name?: string | null
          activity_type_id?: string | null
          completed_qty?: number
          created_at?: string
          cumulative_after?: number | null
          cumulative_before?: number | null
          dpr_id: string
          id?: string
          location?: string | null
          planned_qty?: number
          reason_not_achieved?: string | null
          remarks?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["dpr_activity_status"]
          target_reached?: boolean | null
          total_project_qty?: number | null
          unit?: string | null
        }
        Update: {
          activity_name?: string | null
          activity_type_id?: string | null
          completed_qty?: number
          created_at?: string
          cumulative_after?: number | null
          cumulative_before?: number | null
          dpr_id?: string
          id?: string
          location?: string | null
          planned_qty?: number
          reason_not_achieved?: string | null
          remarks?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["dpr_activity_status"]
          target_reached?: boolean | null
          total_project_qty?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_activities_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_activities_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_config: {
        Row: {
          cutoff_time: string
          first_reminder_time: string
          id: number
          second_reminder_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          cutoff_time?: string
          first_reminder_time?: string
          id?: number
          second_reminder_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          cutoff_time?: string
          first_reminder_time?: string
          id?: number
          second_reminder_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
      dpr_issues: {
        Row: {
          action_required: string | null
          affects_tomorrow: boolean
          category: string
          created_at: string
          description: string
          dpr_id: string
          id: string
          impact: string | null
          photo_url: string | null
          resolution_date: string | null
          responsible_person: string | null
        }
        Insert: {
          action_required?: string | null
          affects_tomorrow?: boolean
          category: string
          created_at?: string
          description: string
          dpr_id: string
          id?: string
          impact?: string | null
          photo_url?: string | null
          resolution_date?: string | null
          responsible_person?: string | null
        }
        Update: {
          action_required?: string | null
          affects_tomorrow?: boolean
          category?: string
          created_at?: string
          description?: string
          dpr_id?: string
          id?: string
          impact?: string | null
          photo_url?: string | null
          resolution_date?: string | null
          responsible_person?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_issues_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_manpower: {
        Row: {
          activity_assigned: string | null
          created_at: string
          dpr_id: string
          id: string
          ot_hours: number
          present: boolean
          regular_hours: number
          remarks: string | null
          trade: string | null
          work_area: string | null
          worker_id: string | null
          worker_name: string | null
        }
        Insert: {
          activity_assigned?: string | null
          created_at?: string
          dpr_id: string
          id?: string
          ot_hours?: number
          present?: boolean
          regular_hours?: number
          remarks?: string | null
          trade?: string | null
          work_area?: string | null
          worker_id?: string | null
          worker_name?: string | null
        }
        Update: {
          activity_assigned?: string | null
          created_at?: string
          dpr_id?: string
          id?: string
          ot_hours?: number
          present?: boolean
          regular_hours?: number
          remarks?: string | null
          trade?: string | null
          work_area?: string | null
          worker_id?: string | null
          worker_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_manpower_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_manpower_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_materials: {
        Row: {
          closing_stock: number | null
          created_at: string
          dpr_id: string
          id: string
          material_id: string | null
          material_name: string | null
          opening_stock: number
          received_today: number
          unit: string | null
          used_today: number
          wastage_photo: string | null
          wastage_qty: number
          wastage_reason: string | null
        }
        Insert: {
          closing_stock?: number | null
          created_at?: string
          dpr_id: string
          id?: string
          material_id?: string | null
          material_name?: string | null
          opening_stock?: number
          received_today?: number
          unit?: string | null
          used_today?: number
          wastage_photo?: string | null
          wastage_qty?: number
          wastage_reason?: string | null
        }
        Update: {
          closing_stock?: number | null
          created_at?: string
          dpr_id?: string
          id?: string
          material_id?: string | null
          material_name?: string | null
          opening_stock?: number
          received_today?: number
          unit?: string | null
          used_today?: number
          wastage_photo?: string | null
          wastage_qty?: number
          wastage_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_materials_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_photos: {
        Row: {
          area: string | null
          captured_at: string
          category: string
          dpr_id: string
          id: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          area?: string | null
          captured_at?: string
          category: string
          dpr_id: string
          id?: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          area?: string | null
          captured_at?: string
          category?: string
          dpr_id?: string
          id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_photos_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_qc: {
        Row: {
          activity_inspected: string | null
          area: string | null
          checklist_response_id: string | null
          corrective_action: string | null
          created_at: string
          defect: string | null
          dpr_id: string
          id: string
          photo_url: string | null
          responsible_person: string | null
          status: string
          target_date: string | null
        }
        Insert: {
          activity_inspected?: string | null
          area?: string | null
          checklist_response_id?: string | null
          corrective_action?: string | null
          created_at?: string
          defect?: string | null
          dpr_id: string
          id?: string
          photo_url?: string | null
          responsible_person?: string | null
          status: string
          target_date?: string | null
        }
        Update: {
          activity_inspected?: string | null
          area?: string | null
          checklist_response_id?: string | null
          corrective_action?: string | null
          created_at?: string
          defect?: string | null
          dpr_id?: string
          id?: string
          photo_url?: string | null
          responsible_person?: string | null
          status?: string
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_qc_checklist_response_id_fkey"
            columns: ["checklist_response_id"]
            isOneToOne: false
            referencedRelation: "checklist_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_qc_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_reports: {
        Row: {
          approved_at: string | null
          confirm_accuracy: boolean
          created_at: string
          dpr_number: string
          id: string
          pdf_path: string | null
          pm_id: string | null
          pm_instruction: string | null
          project_id: string
          readiness: Database["public"]["Enums"]["dpr_readiness"] | null
          readiness_reason: string | null
          report_date: string
          returned_reason: string | null
          site_conditions: Json | null
          site_engineer_id: string
          status: Database["public"]["Enums"]["dpr_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          confirm_accuracy?: boolean
          created_at?: string
          dpr_number: string
          id?: string
          pdf_path?: string | null
          pm_id?: string | null
          pm_instruction?: string | null
          project_id: string
          readiness?: Database["public"]["Enums"]["dpr_readiness"] | null
          readiness_reason?: string | null
          report_date: string
          returned_reason?: string | null
          site_conditions?: Json | null
          site_engineer_id: string
          status?: Database["public"]["Enums"]["dpr_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          confirm_accuracy?: boolean
          created_at?: string
          dpr_number?: string
          id?: string
          pdf_path?: string | null
          pm_id?: string | null
          pm_instruction?: string | null
          project_id?: string
          readiness?: Database["public"]["Enums"]["dpr_readiness"] | null
          readiness_reason?: string | null
          report_date?: string
          returned_reason?: string | null
          site_conditions?: Json | null
          site_engineer_id?: string
          status?: Database["public"]["Enums"]["dpr_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpr_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_safety: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string | null
          dpr_id: string
          id: string
          incident: boolean
          near_miss: boolean
          photo_url: string | null
          ppe_ok: boolean
          responsible_person: string | null
          unsafe_condition: boolean
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          dpr_id: string
          id?: string
          incident?: boolean
          near_miss?: boolean
          photo_url?: string | null
          ppe_ok?: boolean
          responsible_person?: string | null
          unsafe_condition?: boolean
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          dpr_id?: string
          id?: string
          incident?: boolean
          near_miss?: boolean
          photo_url?: string | null
          ppe_ok?: boolean
          responsible_person?: string | null
          unsafe_condition?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dpr_safety_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_tomorrow_activities: {
        Row: {
          activity_name: string | null
          activity_type_id: string | null
          area: string | null
          created_at: string
          dpr_id: string
          expected_duration_hrs: number | null
          id: string
          prerequisite_ok: boolean | null
          remarks: string | null
          target_qty: number | null
          tools_required: string | null
          trade_required: string | null
          unit: string | null
          workers_required: number | null
        }
        Insert: {
          activity_name?: string | null
          activity_type_id?: string | null
          area?: string | null
          created_at?: string
          dpr_id: string
          expected_duration_hrs?: number | null
          id?: string
          prerequisite_ok?: boolean | null
          remarks?: string | null
          target_qty?: number | null
          tools_required?: string | null
          trade_required?: string | null
          unit?: string | null
          workers_required?: number | null
        }
        Update: {
          activity_name?: string | null
          activity_type_id?: string | null
          area?: string | null
          created_at?: string
          dpr_id?: string
          expected_duration_hrs?: number | null
          id?: string
          prerequisite_ok?: boolean | null
          remarks?: string | null
          target_qty?: number | null
          tools_required?: string | null
          trade_required?: string | null
          unit?: string | null
          workers_required?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_tomorrow_activities_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_tomorrow_activities_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      dpr_tomorrow_materials: {
        Row: {
          alert_id: string | null
          available_qty: number
          created_at: string
          dpr_id: string
          id: string
          material_id: string | null
          material_name: string | null
          required_qty: number
          shortfall: number | null
          unit: string | null
        }
        Insert: {
          alert_id?: string | null
          available_qty?: number
          created_at?: string
          dpr_id: string
          id?: string
          material_id?: string | null
          material_name?: string | null
          required_qty?: number
          shortfall?: number | null
          unit?: string | null
        }
        Update: {
          alert_id?: string | null
          available_qty?: number
          created_at?: string
          dpr_id?: string
          id?: string
          material_id?: string | null
          material_name?: string | null
          required_qty?: number
          shortfall?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpr_tomorrow_materials_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "material_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_tomorrow_materials_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpr_tomorrow_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      face_embeddings: {
        Row: {
          angle: string | null
          created_at: string | null
          created_by: string
          embedding_data: Json
          id: string
          photo_url: string | null
          quality_score: number | null
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          angle?: string | null
          created_at?: string | null
          created_by: string
          embedding_data: Json
          id?: string
          photo_url?: string | null
          quality_score?: number | null
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          angle?: string | null
          created_at?: string | null
          created_by?: string
          embedding_data?: Json
          id?: string
          photo_url?: string | null
          quality_score?: number | null
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_embeddings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      fingerprint_templates: {
        Row: {
          created_at: string
          created_by: string
          finger_index: number
          id: string
          quality_score: number | null
          template_data: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          finger_index?: number
          id?: string
          quality_score?: number | null
          template_data: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          finger_index?: number
          id?: string
          quality_score?: number | null
          template_data?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fingerprint_templates_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          active: boolean
          assigned_at: string
          assigned_by: string | null
          created_at: string
          group_id: string
          id: string
          worker_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          worker_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "worker_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          name: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_alerts: {
        Row: {
          available_qty: number
          created_at: string
          dpr_id: string | null
          fulfilled_at: string | null
          id: string
          material_id: string | null
          material_name: string | null
          notes: string | null
          priority: string
          project_id: string
          requested_by: string | null
          required_date: string | null
          required_qty: number
          shortfall: number
          status: Database["public"]["Enums"]["material_alert_status"]
          updated_at: string
        }
        Insert: {
          available_qty?: number
          created_at?: string
          dpr_id?: string | null
          fulfilled_at?: string | null
          id?: string
          material_id?: string | null
          material_name?: string | null
          notes?: string | null
          priority?: string
          project_id: string
          requested_by?: string | null
          required_date?: string | null
          required_qty: number
          shortfall: number
          status?: Database["public"]["Enums"]["material_alert_status"]
          updated_at?: string
        }
        Update: {
          available_qty?: number
          created_at?: string
          dpr_id?: string | null
          fulfilled_at?: string | null
          id?: string
          material_id?: string | null
          material_name?: string | null
          notes?: string | null
          priority?: string
          project_id?: string
          requested_by?: string | null
          required_date?: string | null
          required_qty?: number
          shortfall?: number
          status?: Database["public"]["Enums"]["material_alert_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_alerts_dpr_id_fkey"
            columns: ["dpr_id"]
            isOneToOne: false
            referencedRelation: "dpr_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_dispatch_items: {
        Row: {
          condition: string | null
          created_at: string
          dispatch_id: string
          dispatched_by: string | null
          id: string
          material_name: string
          project_material_id: string | null
          qty_in_factory: number
          qty_received: number | null
          qty_returned: number
          qty_sent: number
          remarks: string | null
          returned_by: string | null
          shortage_qty: number
          specification: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          dispatch_id: string
          dispatched_by?: string | null
          id?: string
          material_name: string
          project_material_id?: string | null
          qty_in_factory?: number
          qty_received?: number | null
          qty_returned?: number
          qty_sent?: number
          remarks?: string | null
          returned_by?: string | null
          shortage_qty?: number
          specification?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          dispatch_id?: string
          dispatched_by?: string | null
          id?: string
          material_name?: string
          project_material_id?: string | null
          qty_in_factory?: number
          qty_received?: number | null
          qty_returned?: number
          qty_sent?: number
          remarks?: string | null
          returned_by?: string | null
          shortage_qty?: number
          specification?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "material_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_dispatch_items_project_material_id_fkey"
            columns: ["project_material_id"]
            isOneToOne: false
            referencedRelation: "project_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_dispatch_items_project_material_id_fkey"
            columns: ["project_material_id"]
            isOneToOne: false
            referencedRelation: "project_stock_summary"
            referencedColumns: ["project_material_id"]
          },
        ]
      }
      material_dispatches: {
        Row: {
          created_at: string
          created_by: string | null
          dispatch_date: string
          dispatch_number: string
          driver_name: string | null
          driver_phone: string | null
          expected_delivery_date: string | null
          factory_store_manager: string | null
          id: string
          notes: string | null
          project_id: string
          qc_project_manager: string | null
          received_at: string | null
          received_by: string | null
          return_date: string | null
          return_verified_by: string | null
          site_incharge: string | null
          source: string
          status: Database["public"]["Enums"]["dispatch_status"]
          updated_at: string
          vehicle_number: string | null
          vendor_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          dispatch_number: string
          driver_name?: string | null
          driver_phone?: string | null
          expected_delivery_date?: string | null
          factory_store_manager?: string | null
          id?: string
          notes?: string | null
          project_id: string
          qc_project_manager?: string | null
          received_at?: string | null
          received_by?: string | null
          return_date?: string | null
          return_verified_by?: string | null
          site_incharge?: string | null
          source?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          updated_at?: string
          vehicle_number?: string | null
          vendor_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          dispatch_number?: string
          driver_name?: string | null
          driver_phone?: string | null
          expected_delivery_date?: string | null
          factory_store_manager?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          qc_project_manager?: string | null
          received_at?: string | null
          received_by?: string | null
          return_date?: string | null
          return_verified_by?: string | null
          site_incharge?: string | null
          source?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          updated_at?: string
          vehicle_number?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_dispatches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name: string
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      methodologies: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          id: string
          title: string
          updated_at: string
          upload_date: string
          uploaded_by: string
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          title: string
          updated_at?: string
          upload_date?: string
          uploaded_by: string
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          title?: string
          updated_at?: string
          upload_date?: string
          uploaded_by?: string
          version?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          activity_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          project_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          project_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          project_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "daily_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_history: {
        Row: {
          completion_percentage: number
          created_at: string
          id: string
          notes: string | null
          project_id: string
          recorded_date: string
        }
        Insert: {
          completion_percentage: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          recorded_date?: string
        }
        Update: {
          completion_percentage?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          recorded_date?: string
        }
        Relationships: []
      }
      project_checklists: {
        Row: {
          assigned_by: string | null
          assigned_date: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          id: string
          overall_notes: string | null
          project_id: string
          status: Database["public"]["Enums"]["project_checklist_status"]
          template_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_date?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          overall_notes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["project_checklist_status"]
          template_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_date?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          overall_notes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["project_checklist_status"]
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_material_stock: {
        Row: {
          current_stock: number
          id: string
          material_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          current_stock?: number
          id?: string
          material_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          current_stock?: number
          id?: string
          material_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_material_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_materials: {
        Row: {
          active: boolean
          boq_qty: number
          category: string | null
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          image_url: string | null
          material_id: string | null
          min_stock_level: number
          name: string
          notes: string | null
          project_id: string
          size: string | null
          specification: string | null
          stage: string | null
          thickness: string | null
          unit: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          active?: boolean
          boq_qty?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          image_url?: string | null
          material_id?: string | null
          min_stock_level?: number
          name: string
          notes?: string | null
          project_id: string
          size?: string | null
          specification?: string | null
          stage?: string | null
          thickness?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          active?: boolean
          boq_qty?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          image_url?: string | null
          material_id?: string | null
          min_stock_level?: number
          name?: string
          notes?: string | null
          project_id?: string
          size?: string | null
          specification?: string | null
          stage?: string | null
          thickness?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          completion_date: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          project_id: string
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          project_id: string
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_photos: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          date_taken: string | null
          id: string
          photo_url: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          date_taken?: string | null
          id?: string
          photo_url: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          date_taken?: string | null
          id?: string
          photo_url?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      project_workers: {
        Row: {
          assigned_date: string | null
          created_at: string
          id: string
          project_id: string
          role: string | null
          worker_id: string
        }
        Insert: {
          assigned_date?: string | null
          created_at?: string
          id?: string
          project_id: string
          role?: string | null
          worker_id: string
        }
        Update: {
          assigned_date?: string | null
          created_at?: string
          id?: string
          project_id?: string
          role?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          actual_end_date: string | null
          budget: number | null
          client_name: string | null
          completion_percentage: number | null
          created_at: string | null
          description: string | null
          expected_end_date: string | null
          id: string
          location: string | null
          name: string
          project_code: string | null
          project_manager: string | null
          project_manager_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          supervisor_id: string
          updated_at: string | null
        }
        Insert: {
          actual_end_date?: string | null
          budget?: number | null
          client_name?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          location?: string | null
          name: string
          project_code?: string | null
          project_manager?: string | null
          project_manager_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          supervisor_id: string
          updated_at?: string | null
        }
        Update: {
          actual_end_date?: string | null
          budget?: number | null
          client_name?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          project_code?: string | null
          project_manager?: string | null
          project_manager_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          supervisor_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          project_material_id: string
          qty: number
          reason: string | null
          ref_id: string | null
          ref_type: string | null
          transaction_date: string
          txn_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          project_material_id: string
          qty: number
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          transaction_date?: string
          txn_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          project_material_id?: string
          qty?: number
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          transaction_date?: string
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_project_material_id_fkey"
            columns: ["project_material_id"]
            isOneToOne: false
            referencedRelation: "project_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_project_material_id_fkey"
            columns: ["project_material_id"]
            isOneToOne: false
            referencedRelation: "project_stock_summary"
            referencedColumns: ["project_material_id"]
          },
        ]
      }
      supervisor_attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          supervisor_id: string
          time_in: string
          time_out: string | null
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          supervisor_id: string
          time_in?: string
          time_out?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          supervisor_id?: string
          time_in?: string
          time_out?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["supervisor_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["supervisor_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["supervisor_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_auth: {
        Row: {
          consent_given: boolean | null
          consent_given_at: string | null
          created_at: string | null
          id: string
          last_login: string | null
          locked_until: string | null
          login_attempts: number | null
          pin_code: string | null
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          consent_given?: boolean | null
          consent_given_at?: string | null
          created_at?: string | null
          id?: string
          last_login?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          pin_code?: string | null
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          consent_given?: boolean | null
          consent_given_at?: string | null
          created_at?: string | null
          id?: string
          last_login?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          pin_code?: string | null
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_auth_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          site_id: string
          status: string
          supervisor_id: string | null
          trade: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          site_id: string
          status?: string
          supervisor_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          site_id?: string
          status?: string
          supervisor_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_groups_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_transfers: {
        Row: {
          created_at: string
          from_group_id: string | null
          id: string
          reason: string | null
          to_group_id: string | null
          transferred_at: string
          transferred_by: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          from_group_id?: string | null
          id?: string
          reason?: string | null
          to_group_id?: string | null
          transferred_at?: string
          transferred_by?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          from_group_id?: string | null
          id?: string
          reason?: string | null
          to_group_id?: string | null
          transferred_at?: string
          transferred_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_transfers_from_group_id_fkey"
            columns: ["from_group_id"]
            isOneToOne: false
            referencedRelation: "worker_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_transfers_to_group_id_fkey"
            columns: ["to_group_id"]
            isOneToOne: false
            referencedRelation: "worker_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_transfers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          address: string
          bank_details: string
          blood_group: Database["public"]["Enums"]["blood_group"]
          created_at: string
          current_group_id: string | null
          current_site_id: string | null
          date_of_joining: string | null
          designation: string | null
          emergency_contact: string
          full_name: string
          id: string
          monthly_salary: number | null
          ot_rate_per_hour: number | null
          phone: string
          photo_url: string | null
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          address: string
          bank_details: string
          blood_group: Database["public"]["Enums"]["blood_group"]
          created_at?: string
          current_group_id?: string | null
          current_site_id?: string | null
          date_of_joining?: string | null
          designation?: string | null
          emergency_contact: string
          full_name: string
          id?: string
          monthly_salary?: number | null
          ot_rate_per_hour?: number | null
          phone: string
          photo_url?: string | null
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          bank_details?: string
          blood_group?: Database["public"]["Enums"]["blood_group"]
          created_at?: string
          current_group_id?: string | null
          current_site_id?: string | null
          date_of_joining?: string | null
          designation?: string | null
          emergency_contact?: string
          full_name?: string
          id?: string
          monthly_salary?: number | null
          ot_rate_per_hour?: number | null
          phone?: string
          photo_url?: string | null
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_current_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "worker_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_current_site_id_fkey"
            columns: ["current_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      project_stock_summary: {
        Row: {
          boq_qty: number | null
          category: string | null
          current_stock: number | null
          min_stock_level: number | null
          name: string | null
          project_id: string | null
          project_material_id: string | null
          specification: string | null
          stage: string | null
          total_received: number | null
          total_used: number | null
          unit: string | null
          vendor: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_list_workers_for_deployment: {
        Args: never
        Returns: {
          current_group_id: string
          current_group_name: string
          current_site_id: string
          current_site_name: string
          designation: string
          full_name: string
          id: string
          supervisor_email: string
          supervisor_id: string
        }[]
      }
      can_access_dpr: { Args: { _dpr_id: string }; Returns: boolean }
      can_edit_dpr: { Args: { _dpr_id: string }; Returns: boolean }
      can_manage_project_materials: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_view_project_materials: {
        Args: { _project_id: string }
        Returns: boolean
      }
      get_all_supervisors: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["supervisor_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_dpr_number: { Args: { _project_id: string }; Returns: string }
      set_worker_pin: {
        Args: { p_pin: string; p_worker_id: string }
        Returns: boolean
      }
      transfer_worker_to_group: {
        Args: { p_reason?: string; p_to_group_id: string; p_worker_id: string }
        Returns: string
      }
      verify_admin_access: { Args: never; Returns: boolean }
      verify_worker_pin: {
        Args: { p_pin: string; p_worker_id: string }
        Returns: boolean
      }
    }
    Enums: {
      blood_group: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
      checklist_input_type:
        | "checkbox"
        | "text"
        | "number"
        | "dropdown"
        | "photo"
        | "signature"
      checklist_stage:
        | "pre_work"
        | "during_work"
        | "post_work"
        | "quality_check"
        | "safety_inspection"
      checklist_type: "pdf" | "interactive"
      dispatch_status:
        | "preparing"
        | "dispatched"
        | "in_transit"
        | "partially_received"
        | "received"
        | "issue"
      dpr_activity_status: "completed" | "partial" | "not_started"
      dpr_readiness: "ready" | "at_risk" | "blocked"
      dpr_status:
        | "not_started"
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "returned"
      material_alert_status: "open" | "procuring" | "fulfilled" | "closed"
      project_checklist_status: "not_started" | "in_progress" | "completed"
      project_status: "active" | "completed" | "on_hold" | "not_started"
      supervisor_role:
        | "admin"
        | "supervisor"
        | "viewer"
        | "management"
        | "project_manager"
        | "procurement"
      worker_department:
        | "fitters"
        | "assembly_team"
        | "helpers"
        | "painters"
        | "plumbers"
        | "electricians"
        | "supervisors"
        | "guest_workers"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      blood_group: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      checklist_input_type: [
        "checkbox",
        "text",
        "number",
        "dropdown",
        "photo",
        "signature",
      ],
      checklist_stage: [
        "pre_work",
        "during_work",
        "post_work",
        "quality_check",
        "safety_inspection",
      ],
      checklist_type: ["pdf", "interactive"],
      dispatch_status: [
        "preparing",
        "dispatched",
        "in_transit",
        "partially_received",
        "received",
        "issue",
      ],
      dpr_activity_status: ["completed", "partial", "not_started"],
      dpr_readiness: ["ready", "at_risk", "blocked"],
      dpr_status: [
        "not_started",
        "draft",
        "submitted",
        "under_review",
        "approved",
        "returned",
      ],
      material_alert_status: ["open", "procuring", "fulfilled", "closed"],
      project_checklist_status: ["not_started", "in_progress", "completed"],
      project_status: ["active", "completed", "on_hold", "not_started"],
      supervisor_role: [
        "admin",
        "supervisor",
        "viewer",
        "management",
        "project_manager",
        "procurement",
      ],
      worker_department: [
        "fitters",
        "assembly_team",
        "helpers",
        "painters",
        "plumbers",
        "electricians",
        "supervisors",
        "guest_workers",
      ],
    },
  },
} as const
