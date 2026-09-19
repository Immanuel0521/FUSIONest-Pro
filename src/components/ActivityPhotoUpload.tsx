import { useRef } from "react";
import { Plus, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface PhotoWithCaption {
  file: File;
  caption: string;
  preview: string;
}

interface ActivityPhotoUploadProps {
  photos: PhotoWithCaption[];
  onPhotosChange: (photos: PhotoWithCaption[]) => void;
  maxPhotos?: number;
}

export function ActivityPhotoUpload({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 10 
}: ActivityPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (photos.length + files.length > maxPhotos) {
      toast({
        variant: "destructive",
        title: `Maximum ${maxPhotos} photos allowed`,
      });
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: `${file.name} is not an image`,
        });
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: `${file.name} is larger than 5MB`,
        });
        return false;
      }
      return true;
    });

    const newPhotos = validFiles.map(file => ({
      file,
      caption: "",
      preview: URL.createObjectURL(file),
    }));

    onPhotosChange([...photos, ...newPhotos]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  };

  const updateCaption = (index: number, caption: string) => {
    const newPhotos = [...photos];
    newPhotos[index] = { ...newPhotos[index], caption };
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-2">Click to upload photos</p>
          <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB each (max {maxPhotos})</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={photo.preview}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              <Input
                placeholder="Add caption..."
                value={photo.caption}
                onChange={(e) => updateCaption(index, e.target.value)}
                className="mt-2 text-xs h-8"
              />
            </div>
          ))}
          
          {photos.length < maxPhotos && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Plus className="w-8 h-8 text-muted-foreground/50 mb-1" />
              <span className="text-xs text-muted-foreground">Add more</span>
            </div>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {photos.length} of {maxPhotos} photos uploaded
        </p>
      )}
    </div>
  );
}