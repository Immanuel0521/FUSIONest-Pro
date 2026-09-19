import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { X, Upload } from "lucide-react";
import { workerFormSchema, validateImageFile } from "@/lib/validationSchemas";
import { encryptData, decryptData } from "@/lib/encryption";

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface WorkerFormProps {
  worker?: any;
  onClose: () => void;
}

export const WorkerForm = ({ worker, onClose }: WorkerFormProps) => {
  const [formData, setFormData] = useState({
    full_name: worker?.full_name || '',
    phone: worker?.phone || '',
    address: worker?.address || '',
    emergency_contact: worker?.emergency_contact || '',
    bank_details: '', // Will be decrypted asynchronously
    blood_group: worker?.blood_group || 'O+',
    designation: worker?.designation || '',
    date_of_joining: worker?.date_of_joining || '',
    monthly_salary: worker?.monthly_salary?.toString() || '',
    ot_rate_per_hour: worker?.ot_rate_per_hour?.toString() || '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(worker?.photo_url || null);
  const [loading, setLoading] = useState(false);
  const [decryptingBankDetails, setDecryptingBankDetails] = useState(false);
  const { toast } = useToast();

  // Decrypt bank details when worker changes
  useEffect(() => {
    const loadWorkerData = async () => {
      if (worker) {
        setDecryptingBankDetails(true);
        try {
          const decryptedBankDetails = await decryptData(worker.bank_details || '');
          setFormData({
            full_name: worker.full_name || '',
            phone: worker.phone || '',
            address: worker.address || '',
            emergency_contact: worker.emergency_contact || '',
            bank_details: decryptedBankDetails,
            blood_group: worker.blood_group || 'O+',
            designation: worker.designation || '',
            date_of_joining: worker.date_of_joining || '',
            monthly_salary: worker.monthly_salary?.toString() || '',
            ot_rate_per_hour: worker.ot_rate_per_hour?.toString() || '',
          });
        } catch (error) {
          console.error('Error decrypting bank details:', error);
          setFormData(prev => ({ ...prev, bank_details: worker.bank_details || '' }));
        } finally {
          setDecryptingBankDetails(false);
        }
        setPhotoPreview(worker.photo_url || null);
      }
    };
    loadWorkerData();
  }, [worker]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast({
          title: "Error",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validationResult = workerFormSchema.safeParse(formData);
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast({
          title: "Validation Error",
          description: errors,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      let photoUrl = worker?.photo_url || null;

      // Upload photo if new file selected
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('worker-photos')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        // Store just the file path, not the full URL
        photoUrl = filePath;
      }

      // Encrypt bank details before storing
      const encryptedBankDetails = await encryptData(formData.bank_details);

      const workerData = {
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        emergency_contact: formData.emergency_contact,
        bank_details: encryptedBankDetails,
        blood_group: formData.blood_group,
        photo_url: photoUrl,
        date_of_joining: formData.date_of_joining || null,
        designation: formData.designation || null,
        monthly_salary: formData.monthly_salary ? parseFloat(formData.monthly_salary) : 0,
        ot_rate_per_hour: formData.ot_rate_per_hour ? parseFloat(formData.ot_rate_per_hour) : 0,
      };

      if (worker) {
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', worker.id);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Worker updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('workers')
          .insert([{ ...workerData, supervisor_id: user.id }]);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Worker added successfully",
        });
      }
      
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {worker ? 'Edit Worker' : 'Add New Worker'}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="photo">Worker Photo</Label>
            <div className="mt-2">
              {photoPreview ? (
                <div className="relative inline-block">
                  <img 
                    src={photoPreview} 
                    alt="Worker preview" 
                    className="w-32 h-32 rounded-lg object-cover border-2 border-primary/20"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={removePhoto}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-primary/20 rounded-lg cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <span className="mt-2 text-sm text-muted-foreground">Upload</span>
                  </div>
                  <input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency_contact">Emergency Contact *</Label>
            <Input
              id="emergency_contact"
              type="tel"
              value={formData.emergency_contact}
              onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
              required
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank_details">Bank Details *</Label>
            <Input
              id="bank_details"
              value={formData.bank_details}
              onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
              required
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blood_group">Blood Group *</Label>
            <Select
              value={formData.blood_group}
              onValueChange={(value) => setFormData({ ...formData, blood_group: value })}
            >
              <SelectTrigger className="glass-card border-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bloodGroups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              placeholder="e.g., Mason, Electrician, Plumber"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_joining">Date of Joining</Label>
            <Input
              id="date_of_joining"
              type="date"
              value={formData.date_of_joining}
              onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly_salary">Monthly Salary (₹)</Label>
            <Input
              id="monthly_salary"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 25000"
              value={formData.monthly_salary}
              onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
              className="glass-card border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ot_rate_per_hour">OT Rate Per Hour (₹)</Label>
            <Input
              id="ot_rate_per_hour"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 100"
              value={formData.ot_rate_per_hour}
              onChange={(e) => setFormData({ ...formData, ot_rate_per_hour: e.target.value })}
              className="glass-card border-primary/20"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            disabled={loading}
          >
            {loading ? "Saving..." : (worker ? "Update Worker" : "Add Worker")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};
