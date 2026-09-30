import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

interface ProfilePhotoUploadProps {
  currentPhotoUrl: string | null;
  userId: string;
  userName: string;
  onPhotoUpdate: (url: string) => void;
}

export function ProfilePhotoUpload({
  currentPhotoUrl,
  userId,
  userName,
  onPhotoUpdate
}: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload JPEG, PNG, or WebP.");
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get persistent public URL (bucket is public)
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      const persistentUrl = `${publicUrl}?t=${Date.now()}`;

      // Update profile with public URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          photo_url: persistentUrl,
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      onPhotoUpdate(persistentUrl);
      toast.success("Profile photo updated successfully!");
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="w-32 h-32">
        <AvatarImage src={currentPhotoUrl || undefined} />
        <AvatarFallback className="text-2xl">
          {userName.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>

      <div>
        <input
          type="file"
          id="photo-upload"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="photo-upload">
          <Button
            variant="outline"
            disabled={uploading}
            asChild
          >
            <span className="cursor-pointer">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Change Photo
                </>
              )}
            </span>
          </Button>
        </label>
      </div>
    </div>
  );
}
