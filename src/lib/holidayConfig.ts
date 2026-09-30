import { supabase } from "@/lib/supabase";

export interface CompanyHoliday {
  id: string;
  company_id: string;
  holiday_date: string; // YYYY-MM-DD
  name: string;
  created_at?: string;
}

export const STANDARD_INDIAN_HOLIDAYS = [
  { monthDay: "01-26", name: "Republic Day" },
  { monthDay: "05-01", name: "May Day / Workers Day" },
  { monthDay: "08-15", name: "Independence Day" },
  { monthDay: "10-02", name: "Gandhi Jayanti" },
  { monthDay: "11-08", name: "Diwali" },
  { monthDay: "12-25", name: "Christmas Day" },
  { monthDay: "01-01", name: "New Year's Day" },
];

const LOCAL_STORAGE_KEY_PREFIX = "fusionest_company_holidays_";

export async function fetchCompanyHolidays(companyId: string): Promise<CompanyHoliday[]> {
  if (!companyId) return [];

  // Try DB first
  try {
    const { data, error } = await supabase
      .from("company_holidays")
      .select("*")
      .eq("company_id", companyId)
      .order("holiday_date", { ascending: true });

    if (!error && data && data.length > 0) {
      // Sync local cache
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${companyId}`, JSON.stringify(data));
      return data as CompanyHoliday[];
    }
  } catch (e) {
    console.warn("[Holidays] Database query fallback to local cache:", e);
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${companyId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error("[Holidays] Failed to parse local cache:", e);
  }

  return [];
}

export async function addCompanyHoliday(
  companyId: string,
  holidayDate: string,
  name: string
): Promise<CompanyHoliday> {
  const newHoliday: CompanyHoliday = {
    id: crypto.randomUUID ? crypto.randomUUID() : `hol_${Date.now()}`,
    company_id: companyId,
    holiday_date: holidayDate,
    name: name.trim(),
    created_at: new Date().toISOString(),
  };

  // Try saving to DB
  try {
    const { data, error } = await supabase
      .from("company_holidays")
      .insert({
        company_id: companyId,
        holiday_date: holidayDate,
        name: name.trim(),
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      newHoliday.id = data.id;
    }
  } catch (e) {
    console.warn("[Holidays] DB insert failed, saved to local cache:", e);
  }

  // Update local storage
  const existing = await fetchCompanyHolidays(companyId);
  const filtered = existing.filter((h) => h.holiday_date !== holidayDate);
  const updated = [...filtered, newHoliday].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${companyId}`, JSON.stringify(updated));

  return newHoliday;
}

export async function removeCompanyHoliday(id: string, companyId: string, holidayDate?: string): Promise<void> {
  try {
    await supabase.from("company_holidays").delete().eq("id", id);
  } catch (e) {
    console.warn("[Holidays] DB delete failed:", e);
  }

  const existing = await fetchCompanyHolidays(companyId);
  const updated = existing.filter((h) => h.id !== id && (holidayDate ? h.holiday_date !== holidayDate : true));
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${companyId}`, JSON.stringify(updated));
}

export async function seedStandardHolidays(companyId: string, year: number): Promise<CompanyHoliday[]> {
  const added: CompanyHoliday[] = [];
  for (const std of STANDARD_INDIAN_HOLIDAYS) {
    const fullDate = `${year}-${std.monthDay}`;
    const h = await addCompanyHoliday(companyId, fullDate, std.name);
    added.push(h);
  }
  return added;
}

export function isHoliday(dateStr: string, holidays: CompanyHoliday[]): CompanyHoliday | undefined {
  return holidays.find((h) => h.holiday_date === dateStr);
}
