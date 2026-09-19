import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";

interface WorkerInvolvement {
  id: string;
  workerName: string;
  projectName: string;
  department: string;
  hoursWorked: number;
  otHours: number;
  date: string;
}

interface WorkerInvolvementTableProps {
  data: WorkerInvolvement[];
}

export function WorkerInvolvementTable({ data }: WorkerInvolvementTableProps) {
  const [search, setSearch] = useState("");

  const filteredData = data.filter(w =>
    w.workerName.toLowerCase().includes(search.toLowerCase()) ||
    w.projectName.toLowerCase().includes(search.toLowerCase()) ||
    w.department.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate summary stats
  const totalHours = data.reduce((sum, w) => sum + w.hoursWorked, 0);
  const totalOT = data.reduce((sum, w) => sum + w.otHours, 0);
  const uniqueWorkers = new Set(data.map(w => w.workerName)).size;

  // Group by department for summary
  const departmentSummary = data.reduce((acc, w) => {
    if (!acc[w.department]) {
      acc[w.department] = { count: 0, hours: 0, ot: 0 };
    }
    acc[w.department].count += 1;
    acc[w.department].hours += w.hoursWorked;
    acc[w.department].ot += w.otHours;
    return acc;
  }, {} as Record<string, { count: number; hours: number; ot: number }>);

  if (data.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Workers Assigned</h3>
          <p className="text-muted-foreground mt-1">No workers have been assigned to activities on this date.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{uniqueWorkers}</p>
            <p className="text-xs text-muted-foreground">Unique Workers</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Total Hours</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalOT.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Total OT Hours</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{Object.keys(departmentSummary).length}</p>
            <p className="text-xs text-muted-foreground">Departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(departmentSummary).map(([dept, stats]) => (
              <Badge key={dept} variant="secondary" className="px-3 py-1">
                <span className="capitalize">{dept}</span>: {stats.count} workers, {stats.hours}h
                {stats.ot > 0 && <span className="text-amber-500 ml-1">(+{stats.ot}h OT)</span>}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Worker Table */}
      <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-lg">Worker Details</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search workers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">OT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell className="font-medium">{worker.workerName}</TableCell>
                    <TableCell>{worker.projectName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {worker.department}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{worker.hoursWorked}</TableCell>
                    <TableCell className="text-right">
                      {worker.otHours > 0 ? (
                        <span className="text-amber-500 font-medium">+{worker.otHours}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No workers match your search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
