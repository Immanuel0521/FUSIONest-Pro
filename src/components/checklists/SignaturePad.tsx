import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";

interface Props {
  onChange: (dataUrl: string | null) => void;
  initial?: string | null;
}

export const SignaturePad = ({ onChange, initial }: Props) => {
  const ref = useRef<SignatureCanvas>(null);

  return (
    <div className="space-y-2">
      <div className="border rounded-lg bg-background overflow-hidden">
        <SignatureCanvas
          ref={ref}
          penColor="hsl(var(--foreground))"
          canvasProps={{ width: 500, height: 160, className: "w-full h-40" }}
          onEnd={() => onChange(ref.current?.toDataURL("image/png") || null)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { ref.current?.clear(); onChange(null); }}>Clear</Button>
        {initial && <span className="text-xs text-muted-foreground self-center">Previously signed</span>}
      </div>
    </div>
  );
};