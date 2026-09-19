import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
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

interface WorkerCardProps {
  worker: {
    id: string;
    full_name: string;
    phone: string;
    address: string;
    blood_group: string;
    photo_url?: string | null;
    designation?: string | null;
    date_of_joining?: string | null;
  };
  index: number;
  onEdit: (worker: any) => void;
  onViewDetails: (worker: any) => void;
  onDelete?: () => void;
}

export const WorkerCard = ({ worker, index, onEdit, onViewDetails, onDelete }: WorkerCardProps) => {
  const { toast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPhoto = async () => {
      if (worker.photo_url) {
        const { data, error } = await supabase.storage
          .from('worker-photos')
          .createSignedUrl(worker.photo_url, 3600); // 1 hour expiry
        
        if (!error && data) {
          setPhotoUrl(data.signedUrl);
        }
      }
    };
    loadPhoto();
  }, [worker.photo_url]);

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', worker.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Worker deleted successfully",
      });

      onDelete?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      className="glass-card p-4 hover-lift transition-all animate-fade-in flex flex-col items-center text-center"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {photoUrl ? (
        <img 
          src={photoUrl} 
          alt={worker.full_name}
          className="w-32 h-32 rounded-full object-cover border-2 border-primary/20 mb-4"
        />
      ) : (
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-4xl mb-4">
          {worker.full_name.charAt(0).toUpperCase()}
        </div>
      )}

      <h3 className="text-lg font-bold mb-1">{worker.full_name}</h3>
      
      {worker.designation && (
        <p className="text-sm text-muted-foreground mb-4">
          {worker.designation}
        </p>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onViewDetails(worker)}
        className="w-full mb-3 border-primary/20 hover:bg-primary/10"
      >
        <QrCode className="w-4 h-4 mr-2" />
        View Details
      </Button>

      <div className="flex gap-2 justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(worker)}
          className="hover:bg-primary/10 h-8 w-8"
        >
          <Edit className="w-4 h-4 text-primary" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/10 h-8 w-8"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Worker</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {worker.full_name}? This will also delete all attendance records for this worker. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
};
