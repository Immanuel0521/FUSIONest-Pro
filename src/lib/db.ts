import Dexie, { Table } from 'dexie';

// Offline Worker interface - excludes sensitive data (bank_details, address, emergency_contact)
// Sensitive data is fetched from Supabase when online only
export interface OfflineWorker {
  id: string;
  full_name: string;
  phone: string;
  designation: string | null;
  blood_group: string;
  date_of_joining: string | null;
  photo_url: string | null;
  supervisor_id: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface AttendanceLog {
  id: string;
  worker_id: string;
  supervisor_id: string;
  date: string;
  time_in: string;
  shift_start: string;
  shift_end: string;
  is_late: boolean;
  late_minutes: number;
  overtime_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface PendingSync {
  id?: number;
  type: 'worker' | 'attendance';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export class AttendProDB extends Dexie {
  workers!: Table<OfflineWorker, string>;
  attendance_logs!: Table<AttendanceLog, string>;
  pending_sync!: Table<PendingSync, number>;

  constructor() {
    super('AttendProDB');
    this.version(2).stores({
      workers: 'id, supervisor_id, synced',
      attendance_logs: 'id, worker_id, supervisor_id, date, synced',
      pending_sync: '++id, type, timestamp'
    });
  }

  // Clear all data on logout for security
  async clearAllData() {
    await this.workers.clear();
    await this.attendance_logs.clear();
    await this.pending_sync.clear();
  }
}

export const db = new AttendProDB();
