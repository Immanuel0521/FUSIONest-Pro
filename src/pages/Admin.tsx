import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errorHandler";
import { Shield, UserPlus, Trash2, Download, Upload, Database, Users, ClipboardCheck, UserCog, Fingerprint, Scan, Camera, LayoutDashboard, Activity, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FingerprintRegistration } from "@/components/FingerprintRegistration";
import { AttendancePhotoReview } from "@/components/AttendancePhotoReview";
import { FaceRegistration } from "@/components/FaceRegistration";
import { SupervisorsOverview } from "@/components/admin/SupervisorsOverview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface Supervisor {
  id: string;
  email: string;
  created_at: string;
  roles?: UserRole[];
}

interface Stats {
  totalSupervisors: number;
  totalWorkers: number;
  totalAttendanceToday: number;
  totalRoles: number;
}

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSupervisors: 0,
    totalWorkers: 0,
    totalAttendanceToday: 0,
    totalRoles: 0,
  });
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "supervisor" | "viewer">("supervisor");
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
    loadSupervisors();
    loadUserRoles();
    loadStats();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/";
        return;
      }

      // Use server-side RPC for admin verification (more secure than client-side query)
      const { data: isAdminUser, error } = await supabase.rpc("verify_admin_access");

      if (error || !isAdminUser) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have admin privileges",
        });
        window.location.href = "/";
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      // Only log in development
      if (import.meta.env.DEV) {
        console.error("Error checking admin access:", error);
      }
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  };

  const loadSupervisors = async () => {
    const { data } = await supabase.rpc("get_all_supervisors");
    if (data) setSupervisors(data);
  };

  const loadUserRoles = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setUserRoles(data);
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [supervisorsData, workersData, attendanceData, rolesData] = await Promise.all([
      supabase.rpc("get_all_supervisors"),
      supabase.from("workers").select("id", { count: "exact", head: true }),
      supabase.from("attendance_logs").select("id", { count: "exact", head: true }).eq("date", today),
      supabase.from("user_roles").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      totalSupervisors: supervisorsData.data?.length || 0,
      totalWorkers: workersData.count || 0,
      totalAttendanceToday: attendanceData.count || 0,
      totalRoles: rolesData.count || 0,
    });
  };

  const assignRole = async () => {
    if (!newEmail) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an email address",
      });
      return;
    }

    try {
      // Note: In production, you'd need a server-side function to look up users by email
      // For now, we'll use the supervisors list
      const targetUser = supervisors.find(s => s.email === newEmail);

      if (!targetUser) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "User not found. Make sure they have signed up first.",
        });
        return;
      }

      // Check if role already exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", targetUser.id)
        .eq("role", newRole)
        .single();

      if (existingRole) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "This user already has this role",
        });
        return;
      }

      // Assign the role
      const { error } = await supabase
        .from("user_roles")
        .insert([{ user_id: targetUser.id, role: newRole }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Role ${newRole} assigned to ${newEmail}`,
      });

      setNewEmail("");
      setNewRole("supervisor");
      loadUserRoles();
      loadSupervisors();
      loadStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: sanitizeError(error),
      });
    }
  };

  const removeRole = async (roleId: string, email: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Role removed from ${email}`,
      });

      loadUserRoles();
      loadSupervisors();
      loadStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: sanitizeError(error),
      });
    }
  };

  const createBackup = async () => {
    setBackupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-database');
      
      if (error) throw error;

      toast({
        title: "Backup Created",
        description: `Backup file: ${data.fileName}. Records: ${data.recordCount.workers} workers, ${data.recordCount.attendance_logs} attendance logs.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: sanitizeError(error),
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const downloadBackup = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('backup-database');
      
      if (error) throw error;

      // Download the backup JSON
      const backupFileName = data.fileName;
      const { data: fileData } = await supabase.storage
        .from('backups')
        .download(backupFileName);

      if (fileData) {
        const url = URL.createObjectURL(fileData);
        const link = document.createElement('a');
        link.href = url;
        link.download = backupFileName;
        link.click();
        URL.revokeObjectURL(url);

        toast({
          title: "Download Complete",
          description: "Backup file downloaded successfully",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: sanitizeError(error),
      });
    }
  };

  const restoreFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoreLoading(true);
    try {
      // Upload backup file to storage
      const fileName = `restore_${Date.now()}.json`;
      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Call restore function
      const { data, error } = await supabase.functions.invoke('restore-database', {
        body: { fileName }
      });

      if (error) throw error;

      toast({
        title: "Restore Complete",
        description: `Restored: ${data.restored.workers} workers, ${data.restored.attendance_logs} attendance logs.`,
      });

      // Reload data
      loadUserRoles();
      loadSupervisors();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: sanitizeError(error),
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Admin Control Center
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage users, supervisors, biometrics, and system backups</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-600 font-medium">System Operational</span>
          </div>
        </div>

        {/* Compact KPI Strip */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Supervisors", value: stats.totalSupervisors, icon: UserCog, tint: "from-primary/20 to-primary/5", iconCls: "text-primary", accent: "text-primary" },
            { label: "Workers", value: stats.totalWorkers, icon: Users, tint: "from-accent/20 to-accent/5", iconCls: "text-accent", accent: "text-accent" },
            { label: "Attendance Today", value: stats.totalAttendanceToday, icon: ClipboardCheck, tint: "from-emerald-500/15 to-emerald-500/5", iconCls: "text-emerald-600", accent: "text-emerald-600" },
            { label: "Roles Assigned", value: stats.totalRoles, icon: Shield, tint: "from-amber-500/15 to-amber-500/5", iconCls: "text-amber-600", accent: "text-amber-600" },
          ].map((s) => (
            <Card key={s.label} className="glass-card p-4 border border-primary/10 hover:border-primary/30 hover:-translate-y-0.5 transition-all group relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.tint} opacity-60 group-hover:opacity-100 transition-opacity`} />
              <div className="relative flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center ${s.iconCls}`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Actions Strip */}
        <Card className="glass-card p-3 border border-primary/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground px-2 hidden sm:inline">Quick Actions:</span>
            <Button size="sm" variant="outline" onClick={createBackup} disabled={backupLoading} className="h-8 text-xs gap-1.5">
              <Database className="w-3.5 h-3.5" /> {backupLoading ? "Creating…" : "Backup Now"}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadBackup} className="h-8 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
            <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1.5">
              <a href="/workforce"><Users className="w-3.5 h-3.5" /> Workforce</a>
            </Button>
            <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1.5">
              <a href="/projects"><Activity className="w-3.5 h-3.5" /> Projects</a>
            </Button>
            <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1.5">
              <a href="/reports"><TrendingUp className="w-3.5 h-3.5" /> Reports</a>
            </Button>
          </div>
        </Card>

        {/* Tabbed sections */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="glass-card border border-primary/10 p-1 h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><LayoutDashboard className="w-3.5 h-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><UserPlus className="w-3.5 h-3.5" /> Users & Roles</TabsTrigger>
            <TabsTrigger value="biometrics" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Scan className="w-3.5 h-3.5" /> Biometrics</TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Database className="w-3.5 h-3.5" /> System</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            <Card className="glass-card p-6 border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                  <UserCog className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Supervisors & Their Projects</h2>
                  <p className="text-xs text-muted-foreground">Expand any supervisor to inspect projects, progress, photos and checklists.</p>
                </div>
              </div>
              <SupervisorsOverview />
            </Card>

            <Card className="glass-card p-6 border border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
              <h3 className="text-base font-bold mb-3 text-primary flex items-center gap-2"><Shield className="w-4 h-4" /> Role Descriptions</h3>
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-background/40 border border-destructive/20">
                  <div className="font-semibold text-destructive mb-1">Admin</div>
                  <div className="text-muted-foreground">Full access to all workers, attendance, projects, and role management.</div>
                </div>
                <div className="p-3 rounded-lg bg-background/40 border border-primary/20">
                  <div className="font-semibold text-primary mb-1">Supervisor</div>
                  <div className="text-muted-foreground">Manages their own workers, projects, and attendance.</div>
                </div>
                <div className="p-3 rounded-lg bg-background/40 border border-accent/20">
                  <div className="font-semibold text-accent mb-1">Viewer</div>
                  <div className="text-muted-foreground">Read-only access to view system data.</div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* USERS & ROLES TAB */}
          <TabsContent value="users" className="space-y-4 mt-0">
        <Card className="glass-card p-6 border border-primary/10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <UserPlus className="w-4.5 h-4.5 text-white" />
            </div>
            Assign Role to Supervisor
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="supervisor@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="glass-card border-primary/30 focus:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                <SelectTrigger className="glass-card border-primary/30">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={assignRole}
                className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-[0_10px_40px_hsl(var(--primary)/0.4)] transition-all"
              >
                Assign Role
              </Button>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 border border-primary/10">
          <h2 className="text-xl font-bold mb-4">Current Roles</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 font-semibold">Email</th>
                  <th className="text-left p-3 font-semibold">Role</th>
                  <th className="text-left p-3 font-semibold">Assigned</th>
                  <th className="text-left p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userRoles.map((role) => {
                  const supervisor = supervisors.find(s => s.id === role.user_id);
                  return (
                    <tr
                      key={role.id}
                      className="border-b border-border/30 hover:bg-primary/5 transition-colors"
                    >
                      <td className="p-3">{supervisor?.email || "Unknown"}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          role.role === 'admin' 
                            ? 'bg-destructive/20 text-destructive' 
                            : role.role === 'supervisor'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-accent/20 text-accent'
                        }`}>
                          {role.role}
                        </span>
                      </td>
                      <td className="p-3">
                        {new Date(role.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove the {role.role} role from {supervisor?.email}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeRole(role.id, supervisor?.email || "")}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {userRoles.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No roles assigned yet.
              </div>
            )}
          </div>
        </Card>
          </TabsContent>

          {/* SYSTEM TAB */}
          <TabsContent value="system" className="space-y-4 mt-0">
        <Card className="glass-card p-6 border border-primary/10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-white" />
            </div>
            Backup & Restore
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold">Create Backup</h3>
              <p className="text-sm text-muted-foreground">
                Create a backup of all workers, attendance logs, and user roles.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={createBackup}
                  disabled={backupLoading}
                  className="bg-gradient-to-r from-primary to-accent hover:shadow-[0_10px_40px_hsl(var(--primary)/0.4)] transition-all"
                >
                  <Database className="w-4 h-4 mr-2" />
                  {backupLoading ? "Creating..." : "Create Backup"}
                </Button>
                <Button
                  onClick={downloadBackup}
                  variant="outline"
                  className="glass-card border-primary/30 hover:border-primary/50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Backup
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Restore from Backup</h3>
              <p className="text-sm text-muted-foreground">
                Restore data from a previously created backup file.
              </p>
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={restoreFromFile}
                  className="hidden"
                  id="restore-file"
                />
                <Button
                  onClick={() => document.getElementById('restore-file')?.click()}
                  disabled={restoreLoading}
                  variant="outline"
                  className="glass-card border-primary/30 text-primary hover:border-primary/50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {restoreLoading ? "Restoring..." : "Restore from File"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
          </TabsContent>

          {/* BIOMETRICS TAB */}
          <TabsContent value="biometrics" className="space-y-4 mt-0">
        <Card className="glass-card p-6 border border-primary/10">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <Camera className="w-4.5 h-4.5 text-white" />
            </div>
            Face Attendance Photos
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Review daily face recognition attendance photos. Approved photos auto-delete after 24 hours.
          </p>
          <AttendancePhotoReview />
        </Card>

        <Card className="glass-card p-6 border border-primary/10">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <Scan className="w-4.5 h-4.5 text-white" />
            </div>
            Face Recognition Registration
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Register worker faces for AI-powered face recognition attendance. Supports camera capture or photo upload.
          </p>
          <FaceRegistration />
        </Card>

        <Card className="glass-card p-6 border border-primary/10">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <Fingerprint className="w-4.5 h-4.5 text-white" />
            </div>
            Fingerprint Registration
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Register worker fingerprints for USB fingerprint scanner attendance.
          </p>
          <FingerprintRegistration />
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
