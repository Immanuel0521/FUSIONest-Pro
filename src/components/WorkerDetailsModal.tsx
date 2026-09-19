import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { WorkerQRCode } from "./WorkerQRCode";
import { Badge } from "./ui/badge";
import { Phone, MapPin, Heart, Briefcase, Calendar, CreditCard, User } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { decryptData } from "@/lib/encryption";

interface WorkerDetailsModalProps {
  worker: {
    id: string;
    full_name: string;
    phone: string;
    emergency_contact: string;
    address: string;
    designation?: string | null;
    blood_group: string;
    bank_details: string;
    date_of_joining?: string | null;
    photo_url?: string | null;
  } | null;
  open: boolean;
  onClose: () => void;
}

export const WorkerDetailsModal = ({ worker, open, onClose }: WorkerDetailsModalProps) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [decryptedBankDetails, setDecryptedBankDetails] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    const loadPhotoAndDecryptData = async () => {
      if (worker?.photo_url) {
        const { data, error } = await supabase.storage
          .from('worker-photos')
          .createSignedUrl(worker.photo_url, 3600); // 1 hour expiry
        
        if (!error && data) {
          setPhotoUrl(data.signedUrl);
        }
      } else {
        setPhotoUrl(null);
      }
      
      // Decrypt bank details
      if (worker?.bank_details) {
        setIsDecrypting(true);
        try {
          const decrypted = await decryptData(worker.bank_details);
          setDecryptedBankDetails(decrypted);
        } catch (error) {
          console.error('Error decrypting bank details:', error);
          setDecryptedBankDetails('Unable to decrypt');
        } finally {
          setIsDecrypting(false);
        }
      } else {
        setDecryptedBankDetails('');
      }
    };
    loadPhotoAndDecryptData();
  }, [worker?.photo_url, worker?.bank_details]);

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Worker Details</DialogTitle>
          <DialogDescription>
            Complete information and QR code for {worker.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Worker Info */}
          <div className="space-y-6">
            {/* Photo and Basic Info */}
            <div className="flex items-center gap-4">
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt={worker.full_name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-2xl">
                  {worker.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold">{worker.full_name}</h3>
                {worker.designation && (
                  <Badge variant="secondary" className="mt-1">
                    {worker.designation}
                  </Badge>
                )}
              </div>
            </div>

            {/* Detailed Information */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{worker.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <User className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Emergency Contact</p>
                  <p className="text-sm text-muted-foreground">{worker.emergency_contact}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{worker.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Heart className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Blood Group</p>
                  <p className="text-sm text-muted-foreground">{worker.blood_group}</p>
                </div>
              </div>

              {worker.designation && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Briefcase className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Designation</p>
                    <p className="text-sm text-muted-foreground">{worker.designation}</p>
                  </div>
                </div>
              )}

              {worker.date_of_joining && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Date of Joining</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(worker.date_of_joining).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CreditCard className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Bank Details</p>
                  <p className="text-sm text-muted-foreground">
                    {isDecrypting ? 'Decrypting...' : decryptedBankDetails || worker.bank_details}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - QR Code */}
          <div>
            <WorkerQRCode workerId={worker.id} workerName={worker.full_name} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
