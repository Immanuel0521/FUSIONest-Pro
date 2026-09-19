## Site Operations — Gap Analysis & Staged Build

The DPR module already exists (`DprWizard`, `DprReview`, `DprOverview`, `DprPanel`, `dpr_reports`, `dpr_manpower`, `dpr_activities`, `dpr_materials`, `dpr_tomorrow_*`, `project_material_stock`, `material_alerts`). Rather than rebuild, I'll extend it. Below is what already works, what needs editing, and what's genuinely new — grouped by the phases you asked for.

### Already present — will only edit, not rebuild
- Auto DPR per project/day, draft/submitted/approved statuses, per-day uniqueness (`dpr_reports` + `next_dpr_number`).
- Auto-prefill manpower from `attendance_logs` and today's activities from `daily_activities`.
- Tomorrow's plan + material shortfall check (`dpr_tomorrow_activities`, `dpr_tomorrow_materials`, `material_alerts`).
- Issues, QC, safety, photos, PDF export, PM review workflow.
- Materials master (`materials`) and per-project stock (`project_material_stock`).
- Project dashboard tab (`DprPanel`) and management overview (`DprOverview`).

### Phase 1 — Site Operations shell + DPR polish (this turn)
- Rename the existing "Site DPR" tab in `ProjectDetail` to **Site Operations** and turn `DprPanel` into a small sub-nav: DPR · Dispatch · Site Stock · 4-Day Look-Ahead · Material Reference · History. Only the DPR sub-tab is functional in Phase 1; the others show "Coming in Phase N" placeholders so we don't scatter half-built UI.
- Edit `DprWizard` Section A to auto-fill from the project record (name, code, client, location, site engineer, PM) — read-only chips. Add editable Supervisor / Weather / Work Start / End fields (stored in a new `dpr_reports.site_conditions jsonb`).
- Section C: replace freeform activity name with a **Stage dropdown** (the 20 stages you listed) alongside the existing activity type. Add `stage text`, `target_reached boolean`, `reason_not_achieved text` to `dpr_activities`; enforce reason when `target_reached=false` in the wizard.
- History: promote the existing history list in `DprPanel` into a filterable table (date range, stage, status, target achieved). Keep it inside the same tab.
- Dashboard cards on `ProjectDetail` overview: reuse existing counts and add "Today's DPR", "Manpower Today", "Open Issues", "Materials in Transit (0 until Phase 3)", "4-Day Readiness (Phase 4)".

### Phase 2 — Material Reference Sheet + Site Stock ledger
- New `project_materials` table (project-scoped reference sheet: category, spec, size, thickness, grade, unit, stage, BOQ qty, vendor, image, notes). Seed selector everywhere from this instead of the global `materials` table for that project.
- New `stock_transactions` ledger (project_id, material_id, type: receipt/usage/adjustment, qty, ref_id, ref_type, user, reason). Current `project_material_stock.current_stock` becomes a derived/materialised view over the ledger.
- DPR material-usage step writes usage rows to the ledger with `ref_type='dpr'`; edits are handled by reversing the previous set and re-inserting (prevents double deduction).
- Site Stock page inside Site Operations: current stock, reserved, available, min level, RAG status, search/filter, authorised Adjustment dialog (reason required, audit logged).

### Phase 3 — Material Dispatch
- New `material_dispatches` + `material_dispatch_items` tables with statuses (preparing → dispatched → in_transit → partially_received → received → issue). Stock ledger receipt row is written only on confirmed receipt at site. Received-qty / condition / shortage captured on receipt.
- "In Transit" count on project dashboard becomes real.

### Phase 4 — 4-Day Look-Ahead
- Use existing `project_milestones` + `daily_activities` schedule plus a new `activity_material_requirements` table (per stage / per activity: material_id, qty, unit). Compute D+1..D+4 skipping Sundays and `holidays`.
- Projected available = current stock + confirmed incoming (dispatches with expected_delivery ≤ activity date) − committed usage from earlier days in the window. RAG per activity: Ready / At Risk / Shortage. Shortage → one-click Material Request into existing `material_alerts` flow.

### Phase 5 — Notifications, PDF, dashboard polish
- Extend the existing `dpr-reminders` cron (already scaffolded) to notify site engineers with an unsubmitted DPR near end of day; reuse `notifications` table so the bell already lights up. Update DPR PDF to include the new sections.

### Technical notes
- Everything scoped by `project_id` with existing RLS patterns (`can_access_dpr`, `has_role`). Every new public table gets GRANTs + RLS in the same migration.
- Ledger-based stock avoids the negative-stock and double-deduction pitfalls; adjustments require reason and are audit-logged.
- Look-ahead treats "working day" via `holidays` table + weekend rule (Sun off, per your existing DPR config).
- Mobile-first: reuse the current wizard's stepper and card layouts; new sub-tabs render as stacked cards on small screens.

### What I'll do right now
Only Phase 1 — the shell + DPR edits (Section A auto-fill chips, Stage dropdown, target-not-achieved reason, filterable history, placeholder sub-tabs). After you confirm Phase 1 looks right in the app, I'll move to Phase 2, then 3, 4, 5 one at a time so nothing half-built lands in production.

Approve to start Phase 1, or tell me what to reorder.