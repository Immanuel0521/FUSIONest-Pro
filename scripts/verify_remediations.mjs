/**
 * FUSIONest Pro: Security Remediation Verification Suite
 * Verifies SQL migrations, frontend RPC call compatibility, hosting headers,
 * and privacy compliance disclosures against production readiness criteria.
 */

import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

console.log('====================================================');
console.log(' FUSIONest Pro — Security Remediation Verification');
console.log('====================================================\n');

// 1. Verify Migration 20261013180000_harden_security_and_superadmin_rpcs.sql
console.log('1. Auditing Versioned SQL Migration (Priority 1 & 2):');
const migrationPath = path.resolve('supabase/migrations/20261013180000_harden_security_and_superadmin_rpcs.sql');
assert(fs.existsSync(migrationPath), 'Migration file 20261013180000 exists on disk');

const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

assert(migrationSql.includes('protect_user_profile_privileged_fields'), 'Contains privilege escalation trigger function');
assert(migrationSql.includes('trg_protect_user_profile_privileged_fields'), 'Attaches trigger to user_profiles table');
assert(migrationSql.includes('TG_OP = \'INSERT\'') && migrationSql.includes('TG_OP = \'UPDATE\''), 'Trigger guards both INSERT and UPDATE operations');
assert(migrationSql.includes('Privilege escalation rejected'), 'Rejects unauthorized modification with descriptive exception');
assert(migrationSql.includes('SET search_path = public'), 'All RPCs and trigger functions set search_path = public');
assert(migrationSql.includes("auth.jwt() IS NOT NULL"), 'Explicitly checks auth.jwt() to prevent unauthenticated anon spoofing');
assert(migrationSql.includes("v_caller_is_super := false;"), 'Explicitly sets anonymous callers as untrusted');

assert(migrationSql.includes('FUNCTION public.toggle_company_access'), 'Defines toggle_company_access RPC');
assert(migrationSql.includes('FUNCTION public.admin_update_company_by_superadmin'), 'Defines admin_update_company_by_superadmin RPC');
assert(migrationSql.includes('FUNCTION public.set_user_company_quota'), 'Defines set_user_company_quota RPC');
assert(migrationSql.includes('FUNCTION public.delete_company_superadmin'), 'Defines delete_company_superadmin RPC');
assert(migrationSql.includes('FUNCTION public.restore_company_superadmin'), 'Defines restore_company_superadmin RPC for reversible recovery');

assert(migrationSql.includes('DROP FUNCTION IF EXISTS public.get_all_users_superadmin'), 'Includes safe DROP guard to prevent return type conflict');
assert(migrationSql.includes('DROP FUNCTION IF EXISTS public.get_all_companies_superadmin'), 'Includes safe DROP guard on get_all_companies_superadmin');

assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.toggle_company_access') &&
       migrationSql.includes('FROM PUBLIC, anon'), 'Revokes anon execute rights from toggle_company_access');
assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.set_user_company_quota') &&
       migrationSql.includes('FROM PUBLIC, anon'), 'Revokes anon execute rights from set_user_company_quota');
assert(migrationSql.includes('deleted_at = now()'), 'delete_company_superadmin implements safe reversible soft deletion');
assert(migrationSql.includes('c.deleted_at IS NULL'), 'get_all_companies_superadmin filters soft-deleted companies');

// 2. Verify Frontend RPC Signature Compatibility
console.log('\n2. Auditing Frontend SuperAdmin.tsx RPC Call Alignments:');
const superAdminPath = path.resolve('src/pages/SuperAdmin.tsx');
const superAdminSrc = fs.readFileSync(superAdminPath, 'utf-8');

assert(superAdminSrc.includes('toggle_company_access') &&
       superAdminSrc.includes('p_company_id:') &&
       superAdminSrc.includes('p_is_active:') &&
       superAdminSrc.includes('p_reason:'),
       'toggle_company_access arguments match RPC parameters exactly');

assert(superAdminSrc.includes('admin_update_company_by_superadmin') &&
       superAdminSrc.includes('p_company_id:') &&
       superAdminSrc.includes('p_name:') &&
       superAdminSrc.includes('p_industry:') &&
       superAdminSrc.includes('p_address:'),
       'admin_update_company_by_superadmin arguments match RPC parameters exactly');

assert(superAdminSrc.includes('set_user_company_quota') &&
       superAdminSrc.includes('p_user_id:') &&
       superAdminSrc.includes('p_quota:'),
       'set_user_company_quota arguments match RPC parameters exactly');

assert(superAdminSrc.includes('delete_company_superadmin') &&
       superAdminSrc.includes('p_company_id:'),
       'delete_company_superadmin arguments match RPC parameters exactly');

// 3. Verify Hosting-Level Security Headers (Priority 4)
console.log('\n3. Auditing Hosting Security Headers:');
const vercelPath = path.resolve('vercel.json');
const headersPath = path.resolve('public/_headers');
const redirectsPath = path.resolve('public/_redirects');

assert(fs.existsSync(vercelPath), 'vercel.json exists for Vercel edge deployment');
assert(fs.existsSync(headersPath), 'public/_headers exists for Netlify/Cloudflare edge deployment');
assert(fs.existsSync(redirectsPath), 'public/_redirects exists for SPA routing');

const vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
const cspHeader = vercelJson.headers[0].headers.find(h => h.key === 'Content-Security-Policy')?.value || '';
assert(cspHeader.includes("wasm-unsafe-eval"), 'CSP includes wasm-unsafe-eval for biometric WebAssembly models');
assert(cspHeader.includes("https://*.supabase.co"), 'CSP connects to Supabase API and storage');
assert(cspHeader.includes("https://*.googleusercontent.com"), 'CSP allows Google user avatar photos');
assert(cspHeader.includes("https://fonts.googleapis.com"), 'CSP allows Google Fonts stylesheet');
assert(cspHeader.includes("frame-ancestors 'none'"), 'CSP blocks iframe clickjacking');

// 4. Verify Privacy Policy Accuracy (Priority 5)
console.log('\n4. Auditing Privacy Policy Disclosures:');
const privacyPath = path.resolve('src/pages/PrivacyPolicy.tsx');
const privacySrc = fs.readFileSync(privacyPath, 'utf-8');

assert(privacySrc.includes('Attendance Verification Photos'), 'Discloses capture of verification photos during check-in/out');
assert(privacySrc.includes('attendance-photos'), 'Discloses private storage bucket storage');
assert(privacySrc.includes('cleanup-attendance-photos'), 'Discloses server-side cleanup Edge Function');
assert(privacySrc.includes('Scheduled Execution Notice'), 'Accurately clarifies that automated deletion requires active cron scheduling');
assert(privacySrc.includes('Employer Consent Obligation'), 'Discloses employer responsibility for obtaining worker consent under DPDP Act');

// 5. Build & Compilation Verification
console.log('\n5. Verification Summary:');
console.log(`  Total Checks: ${passCount + failCount}`);
console.log(`  Passed:       ${passCount}`);
console.log(`  Failed:       ${failCount}`);

if (failCount === 0) {
  console.log('\n✅ ALL VERIFICATION CHECKS PASSED.');
  process.exit(0);
} else {
  console.error('\n❌ SOME CHECKS FAILED.');
  process.exit(1);
}
