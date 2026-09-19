import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Clock, Search, Image, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AttendancePhoto {
  id: string;
  worker_id: string;
  attendance_id: string | null;
  photo_url: string;
  photo_type: string;
  date: string;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  worker?: {
    full_name: string;
    photo_url: string | null;
  };
}

export function AttendancePhotoReview() {
  const [photos, setPhotos] = useState<AttendancePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    loadPhotos();
  }, [selectedDate]);

  const loadPhotos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_photos')
      .select(`*, worker:workers(full_name, photo_url)`)
      .eq('date', selectedDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading photos:', error);
      toast.error('Failed to load attendance photos');
    } else {
      const rows = (data as any[]) || [];
      // Generate signed URLs for private bucket (or keep already-signed/legacy URLs)
      const withSigned = await Promise.all(
        rows.map(async (p) => {
          let url = p.photo_url as string;
          const m = url?.match(/^attendance-photos\/(.+)$/);
          if (m) {
            const { data: signed } = await supabase.storage
              .from('attendance-photos')
              .createSignedUrl(m[1], 60 * 60);
            if (signed?.signedUrl) url = signed.signedUrl;
          }
          return { ...p, photo_url: url };
        })
      );
      setPhotos(withSigned as any);
    }
    setLoading(false);
  };

  const approvePhoto = async (photoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('attendance_photos')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', photoId);

    if (error) {
      toast.error('Failed to approve photo');
    } else {
      toast.success('Photo approved. Will auto-delete after 24 hours.');
      loadPhotos();
    }
  };

  const approveAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const pendingIds = filteredPhotos.filter(p => !p.approved).map(p => p.id);
    if (pendingIds.length === 0) {
      toast.info('No pending photos to approve');
      return;
    }

    const { error } = await supabase
      .from('attendance_photos')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .in('id', pendingIds);

    if (error) {
      toast.error('Failed to approve photos');
    } else {
      toast.success(`${pendingIds.length} photos approved. Will auto-delete after 24 hours.`);
      loadPhotos();
    }
  };

  const deletePhoto = async (photo: AttendancePhoto) => {
    // Delete from storage first - look up original path from DB
    const { data: dbRow } = await supabase
      .from('attendance_photos')
      .select('photo_url')
      .eq('id', photo.id)
      .maybeSingle();
    const original = (dbRow as any)?.photo_url || photo.photo_url;
    const pathMatch = original.match(/attendance-photos\/(.+?)(\?|$)/);
    if (pathMatch) {
      await supabase.storage.from('attendance-photos').remove([pathMatch[1]]);
    }

    const { error } = await supabase
      .from('attendance_photos')
      .delete()
      .eq('id', photo.id);

    if (error) {
      toast.error('Failed to delete photo');
    } else {
      toast.success('Photo deleted');
      loadPhotos();
    }
  };

  const filteredPhotos = photos.filter(p => {
    const matchesSearch = p.worker?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'pending' && !p.approved) || (filter === 'approved' && p.approved);
    return matchesSearch && matchesFilter;
  });

  const pendingCount = photos.filter(p => !p.approved).length;
  const approvedCount = photos.filter(p => p.approved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <Label>Search Worker</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({photos.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={filter === 'approved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('approved')}
          >
            Approved ({approvedCount})
          </Button>
        </div>
        {pendingCount > 0 && (
          <Button onClick={approveAll} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve All ({pendingCount})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No attendance photos for this date</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredPhotos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden border hover:shadow-lg transition-all">
              <div className="relative aspect-square bg-muted">
                <img
                  src={photo.photo_url}
                  alt={`${photo.worker?.full_name} attendance`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setPreviewPhoto(photo.photo_url)}
                />
                <Badge
                  className={`absolute top-2 right-2 ${
                    photo.approved
                      ? 'bg-green-500'
                      : 'bg-amber-500'
                  }`}
                >
                  {photo.approved ? 'Approved' : 'Pending'}
                </Badge>
                <Badge className="absolute top-2 left-2 bg-background/80 text-foreground">
                  {photo.photo_type === 'checkin' ? 'Check-In' : 'Check-Out'}
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={photo.worker?.photo_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {photo.worker?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{photo.worker?.full_name}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(photo.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewPhoto(photo.photo_url)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  {!photo.approved && (
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => approvePhoto(photo.id)}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deletePhoto(photo)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attendance Photo</DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <img
              src={previewPhoto}
              alt="Attendance photo"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
