import { supabase } from '@/lib/supabase';
import { db, OfflineWorker } from '@/lib/db';
import { toast } from 'sonner';

// Fields to exclude from offline storage for security
const SENSITIVE_WORKER_FIELDS = ['bank_details', 'address', 'emergency_contact'] as const;

export class SyncManager {
  private static instance: SyncManager;
  private syncing = false;

  private constructor() {}

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  async syncAll() {
    if (this.syncing) return;
    
    this.syncing = true;
    try {
      await this.syncWorkers();
      await this.syncAttendance();
      await this.processPendingSync();
      toast.success('Data synced successfully');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed. Will retry when online.');
    } finally {
      this.syncing = false;
    }
  }

  // Strip sensitive fields before storing in IndexedDB
  private sanitizeWorkerForOffline(worker: any): OfflineWorker {
    const { bank_details, address, emergency_contact, ...safeData } = worker;
    return { ...safeData, synced: true };
  }

  async syncWorkers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Only fetch non-sensitive fields for offline storage
      const { data: remoteWorkers, error } = await supabase
        .from('workers')
        .select('id, full_name, phone, designation, blood_group, date_of_joining, photo_url, supervisor_id, created_at, updated_at')
        .eq('supervisor_id', user.id);

      if (error) throw error;

      if (remoteWorkers) {
        await db.workers.clear();
        await db.workers.bulkPut(
          remoteWorkers.map(w => this.sanitizeWorkerForOffline(w))
        );
      }
    } catch (error) {
      console.error('Worker sync error:', error);
      throw error;
    }
  }

  async syncAttendance() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Limit to last 30 days for performance and security
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: remoteAttendance, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('supervisor_id', user.id)
        .gte('date', dateLimit);

      if (error) throw error;

      if (remoteAttendance) {
        await db.attendance_logs.clear();
        await db.attendance_logs.bulkPut(
          remoteAttendance.map(a => ({ ...a, synced: true }))
        );
      }
    } catch (error) {
      console.error('Attendance sync error:', error);
      throw error;
    }
  }

  async processPendingSync() {
    const pending = await db.pending_sync.toArray();
    
    for (const item of pending) {
      try {
        if (item.type === 'worker') {
          await this.syncWorkerItem(item);
        } else if (item.type === 'attendance') {
          await this.syncAttendanceItem(item);
        }
        await db.pending_sync.delete(item.id!);
      } catch (error) {
        console.error('Error processing pending sync:', error);
      }
    }
  }

  private async syncWorkerItem(item: any) {
    const { action, data } = item;
    
    if (action === 'create') {
      const { error } = await supabase.from('workers').insert(data);
      if (error) throw error;
    } else if (action === 'update') {
      const { error } = await supabase
        .from('workers')
        .update(data)
        .eq('id', data.id);
      if (error) throw error;
    } else if (action === 'delete') {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', data.id);
      if (error) throw error;
    }
  }

  private async syncAttendanceItem(item: any) {
    const { action, data } = item;
    
    if (action === 'create') {
      const { error } = await supabase.from('attendance_logs').insert(data);
      if (error) throw error;
    } else if (action === 'update') {
      const { error } = await supabase
        .from('attendance_logs')
        .update(data)
        .eq('id', data.id);
      if (error) throw error;
    } else if (action === 'delete') {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', data.id);
      if (error) throw error;
    }
  }

  async addToPendingSync(type: 'worker' | 'attendance', action: 'create' | 'update' | 'delete', data: any) {
    await db.pending_sync.add({
      type,
      action,
      data,
      timestamp: Date.now()
    });
  }

  // Clear all offline data on logout for security
  async clearOnLogout() {
    await db.clearAllData();
  }
}

export const syncManager = SyncManager.getInstance();
