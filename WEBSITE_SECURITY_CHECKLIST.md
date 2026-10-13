# Production Release & Security Checklist

Use this checklist for every production deployment, environment update, and release cycle of **FUSIONest Pro**.

---

## 1. Credentials, Secrets & Environment

- [ ] **No Secrets in Code:** Ensure no Supabase service role keys, JWT secrets, database connection strings, or cloud tokens exist in client source files (`src/`).
- [ ] **`.env` Ignored in Git:** Verify `.env` and `.env.*` remain strictly listed in `.gitignore` and are never committed.
- [ ] **Template Maintained:** Ensure `.env.example` is kept up-to-date with any new required environment variables.
- [ ] **Production Keys Isolated:** Confirm production Supabase project keys are distinct from development/staging test keys.
- [ ] **Database Connection Security:** Verify SSL enforcement is required on direct PostgreSQL connections (`sslmode=require`).

---

## 2. Authentication & Authorization

- [ ] **Route Protection:** All internal routes wrapped with `<ProtectedRoute requireAuth>` in `src/App.tsx`.
- [ ] **Role Authorization:** Routes requiring elevated permissions specify `allowedRoles` (e.g. `allowedRoles={["admin"]}`).
- [ ] **Strict Role Check:** Ensure `ProtectedRoute` enforces rejection if `userRole` is missing, null, or not in `allowedRoles`.
- [ ] **Super Admin Isolation:** Verify `/super-admin` requires both session authentication and server-verified `is_super_admin` flag with active loading state.
- [ ] **Company Membership Validation:** Verify deactivated members (`is_active = false`) are redirected to `/access-suspended`.
- [ ] **Logout Purge:** On logout, confirm session tokens are revoked and user-specific caches in memory/storage are reset.

---

## 3. Database & Row Level Security (RLS)

- [ ] **RLS Enabled on All Tables:** Run verification in PostgreSQL:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
  ```
  *(Must return 0 rows for production data tables).*
- [ ] **No Unchecked Joins/RPCs:** Ensure custom RPCs (e.g. `join_company_for_user`) disallow role elevation to `'admin'` via arbitrary join codes.
- [ ] **Tenant Isolation:** Confirm cross-company queries verify `company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())`.
- [ ] **SQL Query Safety:** All database communication uses parameterized PostgREST calls or prepared statements.

---

## 4. File Uploads & Storage Security

- [ ] **Client MIME & Extension Checks:** File pickers enforce allowed extensions (`.pdf`, `.jpg`, `.png`, `.webp`, `.xlsx`) and file size limits (&le; 10MB).
- [ ] **Supabase Storage Bucket Policies:**
  - `profile-photos`: Public read, authenticated user write strictly to own `user_id/` folder.
  - `attendance-photos`: Private read (authenticated only), supervisor write.
  - `methodologies` & `checklist-pdfs`: Authenticated read, admin-only write.
- [ ] **Randomized File Names:** Upload paths include user IDs and timestamps or UUIDs to prevent file overwrites and path traversal.

---

## 5. Client Caching & Offline Service Worker

- [ ] **No API Caching in Service Worker:** `public/sw.js` must strictly bypass all `supabase.co` and external API requests so sensitive personal and biometric data is never stored in browser `CacheStorage`.
- [ ] **Cache Versioning:** Bump `STATIC_CACHE` and `DYNAMIC_CACHE` versions in `sw.js` upon major UI releases.
- [ ] **Development SW Disabled:** Service worker registers only in production (`import.meta.env.PROD`).

---

## 6. Privacy, Legal & Regulatory Compliance

- [ ] **Privacy Policy Present:** Accessible at `/privacy` with DPDP Act (2023) and GDPR data processing disclosures.
- [ ] **Terms of Service Present:** Accessible at `/terms` with acceptable use, operational disclaimers, and Indian governing law.
- [ ] **Biometric Notice & Consent:** Workforce onboardings inform workers of facial landmark extraction purposes and retention periods.
- [ ] **Grievance Contact:** Valid privacy and grievance contact email addresses displayed.
- [ ] **Robots Exclusion:** `robots.txt` strictly disallows indexing of private operational URLs (`/admin`, `/super-admin`, `/dashboard`, `/workforce`, `/reports`).
- [ ] **Sitemap Cleanliness:** `sitemap.xml` includes only public landing and legal information pages.

---

## 7. Performance & Build Verification

- [ ] **Type Safety:** `npx tsc --noEmit` completes with **0 errors**.
- [ ] **CSS Spec Compliance:** Standard CSS `@import` rules precede all `@tailwind` directives in `src/index.css`.
- [ ] **Code Splitting:** Heavy vendor dependencies (`face-api`, `jspdf`, `xlsx`, `framer-motion`) isolated into dedicated vendor chunks in `vite.config.ts`.
- [ ] **Production Build Check:** `npm run build` completes cleanly with exit code 0.
