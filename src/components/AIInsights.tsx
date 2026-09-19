import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, FileText, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AIInsightsProps {
  type: "daily_summary" | "project_insights" | "weekly_summary" | "delay_analysis";
  projectId?: string;
  title?: string;
}

export function AIInsights({ type, projectId, title }: AIInsightsProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-activity-summary', {
        body: { type, projectId }
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        toast({ title: data.error, variant: "destructive" });
      } else {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error("Error generating summary:", err);
      setError("Failed to generate AI summary. Please try again.");
      toast({ title: "Failed to generate summary", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'daily_summary': return <FileText className="h-5 w-5" />;
      case 'weekly_summary': return <TrendingUp className="h-5 w-5" />;
      case 'delay_analysis': return <AlertTriangle className="h-5 w-5" />;
      default: return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'daily_summary': return 'Daily Activity Summary';
      case 'weekly_summary': return 'Weekly Summary';
      case 'project_insights': return 'Project Insights';
      case 'delay_analysis': return 'Delay Analysis';
      default: return 'AI Insights';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'daily_summary': return 'AI-generated overview of today\'s activities';
      case 'weekly_summary': return 'Comprehensive weekly progress analysis';
      case 'project_insights': return 'Smart insights about project health and progress';
      case 'delay_analysis': return 'Analysis of delays and recommended actions';
      default: return 'AI-powered analysis and recommendations';
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
              {getIcon()}
            </div>
            <div>
              <CardTitle className="text-lg">{getTitle()}</CardTitle>
              <CardDescription>{getDescription()}</CardDescription>
            </div>
          </div>
          <Button 
            onClick={generateSummary} 
            disabled={loading}
            variant={summary ? "outline" : "default"}
            className="gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : summary ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p>{error}</p>
            <Button variant="link" onClick={generateSummary} className="mt-2">
              Try again
            </Button>
          </div>
        ) : summary ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {summary.split('\n').map((line, i) => {
                // Handle headers
                if (line.startsWith('## ')) {
                  return <h3 key={i} className="text-base font-semibold mt-4 mb-2">{line.replace('## ', '')}</h3>;
                }
                if (line.startsWith('# ')) {
                  return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace('# ', '')}</h2>;
                }
                // Handle bullet points
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return <li key={i} className="ml-4">{line.replace(/^[-*] /, '')}</li>;
                }
                // Handle numbered lists
                if (/^\d+\. /.test(line)) {
                  return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
                }
                // Handle bold text
                if (line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={i} className="mb-1">
                      {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                    </p>
                  );
                }
                // Empty lines
                if (!line.trim()) return <br key={i} />;
                // Regular text
                return <p key={i} className="mb-1">{line}</p>;
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Generate" to get AI-powered insights</p>
            <p className="text-xs mt-1">Powered by Lovable AI</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
