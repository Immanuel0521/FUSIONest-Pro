import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface Args {
  project: any;
  milestones: any[];
  history: any[];
  activities: any[];
}

export async function generateProjectReport({ project, milestones, history, activities }: Args) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(20, 110, 110);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(project.name, 14, 14);
  doc.setFontSize(10);
  doc.text(`${project.client_name || "—"} · ${project.location || "—"}`, 14, 22);

  doc.setTextColor(0, 0, 0);
  let y = 40;

  // Summary
  doc.setFontSize(12);
  doc.text("Project Summary", 14, y); y += 6;
  doc.setFontSize(9);
  const lines = [
    `Status: ${project.status}`,
    `Manager: ${project.project_manager || "—"}`,
    `Start: ${project.start_date || "—"}    End: ${project.expected_end_date || "—"}`,
    `Completion: ${project.completion_percentage || 0}%`,
    `Budget: ${project.budget || "—"}`,
  ];
  lines.forEach((l) => { doc.text(l, 14, y); y += 5; });
  y += 4;

  // Milestones
  if (milestones.length) {
    doc.setFontSize(12); doc.text("Milestones", 14, y); y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Name", "Target", "Status", "Completed"]],
      body: milestones.map((m) => [m.name, m.target_date || "—", m.status, m.completion_date || "—"]),
      headStyles: { fillColor: [20, 110, 110] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Activities
  if (activities.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12); doc.text("Recent Activities", 14, y); y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Date", "Description", "Hours"]],
      body: activities.slice(0, 30).map((a) => [a.date, (a.description || "").slice(0, 80), a.hours_worked ?? "—"]),
      headStyles: { fillColor: [20, 110, 110] },
      styles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Progress history
  if (history.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12); doc.text("Progress History", 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["Date", "Completion %", "Notes"]],
      body: history.map((h) => [h.recorded_date, `${h.completion_percentage}%`, h.notes || "—"]),
      headStyles: { fillColor: [20, 110, 110] },
      styles: { fontSize: 9 },
    });
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated ${format(new Date(), "PPpp")} · Page ${i}/${pages}`, 14, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(`${project.name.replace(/\s+/g, "_")}-report.pdf`);
}
