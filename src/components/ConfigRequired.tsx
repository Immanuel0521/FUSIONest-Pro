import React, { useState } from "react";
import { Database, Copy, Check, RefreshCw, KeyRound, AlertCircle, ExternalLink } from "lucide-react";

export const ConfigRequired: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const envVars = [
    {
      name: "VITE_SUPABASE_URL",
      description: "Your Supabase project URL (e.g. https://xyzcompany.supabase.co)",
      example: "https://your-project-id.supabase.co",
    },
    {
      name: "VITE_SUPABASE_PUBLISHABLE_KEY",
      description: "Your Supabase anon / public API key",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    },
    {
      name: "VITE_SUPABASE_PROJECT_ID",
      description: "Optional project reference identifier",
      example: "your-project-id",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Setup Required
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Supabase Configuration Required
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              FUSIONest Pro is deployed, but the client cannot connect to your Supabase backend because the required environment variables are not yet configured on your hosting provider (Netlify).
            </p>
          </div>
        </div>

        {/* Required Variables */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Required Environment Variables
          </h2>
          <div className="space-y-2">
            {envVars.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-sm gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-200 text-xs sm:text-sm">
                      {item.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.name, item.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                  title="Copy variable name"
                >
                  {copiedKey === item.name ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-step Netlify instructions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            How to configure on Netlify
          </h2>
          <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside pl-1">
            <li className="leading-relaxed">
              Open your{" "}
              <a
                href="https://app.netlify.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Netlify Dashboard <ExternalLink className="w-3 h-3 inline" />
              </a>{" "}
              and select this site.
            </li>
            <li className="leading-relaxed">
              Go to <strong className="font-semibold text-slate-900 dark:text-slate-100">Site configuration &rarr; Environment variables</strong>.
            </li>
            <li className="leading-relaxed">
              Click <strong className="font-semibold text-slate-900 dark:text-slate-100">Add a variable</strong> and paste your values for <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">VITE_SUPABASE_URL</code> and <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
            </li>
            <li className="leading-relaxed">
              Go to the <strong className="font-semibold text-slate-900 dark:text-slate-100">Deploys</strong> tab, click <strong className="font-semibold text-slate-900 dark:text-slate-100">Trigger deploy</strong>, and select <strong className="font-semibold text-slate-900 dark:text-slate-100">Clear cache and deploy site</strong>.
            </li>
          </ol>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 flex-1 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Check Connection &amp; Refresh
          </button>
        </div>
      </div>
    </div>
  );
};
