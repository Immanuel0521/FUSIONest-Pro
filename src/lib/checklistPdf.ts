import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";

interface ResponseRow {
  item_id: string;
  response_value: string | null;
  response_photos: string[] | null;
  response_signature: string | null;
}
interface Item {
  id: string;
  item_number: number;
  item_text: string;
  input_type: string;
}
interface Args {
  projectName: string;
  templateTitle: string;
  inspector: string;
  completedAt: string | null;
  overallNotes: string | null;
  items: Item[];
  responses: ResponseRow[];
}

const fetchSignedDataUrl = async (path: string): Promise<string | null> => {
  try {
    const { data } = await supabase.storage.from("checklist-responses").createSignedUrl(path, 600);
    if (!data?.signedUrl) return null;
    const r = await fetch(data.signedUrl);
    const blob = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
};

export const exportChecklistPdf = async (a: Args) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(a.templateTitle, 14, 18);
  doc.setFontSize(10);
  doc.text(`Project: ${a.projectName}`, 14, 26);
  doc.text(`Inspector: ${a.inspector}`, 14, 32);
  if (a.completedAt) doc.text(`Completed: ${new Date(a.completedAt).toLocaleString()}`, 14, 38);

  const rows = a.items.map((it) => {
    const r = a.responses.find((x) => x.item_id === it.id);
    let val = r?.response_value || "";
    if (it.input_type === "photo" && r?.response_photos?.length) val = `[${r.response_photos.length} photo(s)]`;
    if (it.input_type === "signature") val = r?.response_signature ? "[signed]" : "";
    return [String(it.item_number), it.item_text, val];
  });

  autoTable(doc, {
    startY: 44,
    head: [["#", "Item", "Response"]],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 184, 166] },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;

  // Embed signatures and photos
  for (const it of a.items) {
    const r = a.responses.find((x) => x.item_id === it.id);
    if (it.input_type === "signature" && r?.response_signature) {
      const url = await fetchSignedDataUrl(r.response_signature);
      if (url) {
        if (y > 240) { doc.addPage(); y = 18; }
        doc.setFontSize(10);
        doc.text(`Signature for #${it.item_number}:`, 14, y);
        try { doc.addImage(url, "PNG", 14, y + 2, 60, 25); } catch {}
        y += 32;
      }
    }
    if (it.input_type === "photo" && r?.response_photos?.length) {
      doc.setFontSize(10);
      if (y > 240) { doc.addPage(); y = 18; }
      doc.text(`Photos for #${it.item_number}:`, 14, y);
      y += 4;
      let x = 14;
      for (const p of r.response_photos) {
        const url = await fetchSignedDataUrl(p);
        if (!url) continue;
        if (y > 230) { doc.addPage(); y = 18; x = 14; }
        try { doc.addImage(url, "JPEG", x, y, 40, 30); } catch {}
        x += 44;
        if (x > 170) { x = 14; y += 34; }
      }
      y += 36;
    }
  }

  if (a.overallNotes) {
    if (y > 250) { doc.addPage(); y = 18; }
    doc.setFontSize(11);
    doc.text("Overall Notes:", 14, y);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(a.overallNotes, 180), 14, y + 6);
  }

  doc.save(`${a.templateTitle.replace(/\s+/g, "_")}_${a.projectName.replace(/\s+/g, "_")}.pdf`);
};