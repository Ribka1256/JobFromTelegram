/**
 * src/repositories/companies.repository.js
 * Uses @supabase/supabase-js (HTTPS) instead of Prisma (TCP).
 */

import { supabase } from "../database/supabase.js";

function assertOk({ error }, label) {
  if (error) throw new Error(`[${label}] ${error.message}`);
}

export async function findAllCompanies({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, website, logoUrl, isVerified")
    .order("name", { ascending: true })
    .limit(limit);
  assertOk({ error }, "findAllCompanies");
  return data || [];
}

export async function findCompanyById(id) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, website, email, phone, logoUrl, description, isVerified")
    .eq("id", id)
    .single();
  assertOk({ error }, "findCompanyById");
  return data;
}

export async function findJobsByCompany(companyId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from("jobs")
    .select(
      "id, title, employmentType, experienceLevel, postedAt, deadline, location:locations(city)",
      { count: "exact" }
    )
    .eq("companyId",   companyId)
    .eq("isActive",    true)
    .eq("isDuplicate", false)
    .order("postedAt", { ascending: false })
    .range(skip, skip + limit - 1);
  assertOk({ error }, "findJobsByCompany");
  return { jobs: data || [], total: count || 0 };
}
