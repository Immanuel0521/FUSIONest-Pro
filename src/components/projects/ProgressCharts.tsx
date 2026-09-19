import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

export const ProgressCharts = ({ refreshKey }: { refreshKey: number }) => {
  const [hoursData, setHoursData] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: acts } = await supabase
        .from("daily_activities")
        .select(`
          id,
          project:projects(name),
          activity_type:activity_types(name),
          activity_workers(hours_worked, ot_hours)
        `)
        .limit(500);

      const list: any[] = (acts as any) || [];

      const hoursMap: Record<string, number> = {};
      const typeMap: Record<string, number> = {};

      list.forEach((a) => {
        const projName = a.project?.name || "Unknown";
        const total = (a.activity_workers || []).reduce(
          (s: number, w: any) => s + (Number(w.hours_worked) || 0) + (Number(w.ot_hours) || 0),
          0
        );
        hoursMap[projName] = (hoursMap[projName] || 0) + total;

        const t = a.activity_type?.name || "Other";
        typeMap[t] = (typeMap[t] || 0) + 1;
      });

      setHoursData(Object.entries(hoursMap).map(([name, hours]) => ({ name, hours })).slice(0, 8));
      setTypeData(Object.entries(typeMap).map(([name, value]) => ({ name, value })));
    })();
  }, [refreshKey]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="glass-card rounded-2xl p-5">
        <h3 className="font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Hours per Project</h3>
        {hoursData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hoursData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="glass-card rounded-2xl p-5">
        <h3 className="font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Activity Types</h3>
        {typeData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 11 }}>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};
