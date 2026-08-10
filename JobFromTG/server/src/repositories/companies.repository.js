/**
 * src/repositories/companies.repository.js
 * All Prisma queries for the Company model.
 */

import { prisma } from "../database/prisma.js";

export async function findAllCompanies({ limit = 100 } = {}) {
  return prisma.company.findMany({
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      website: true,
      logoUrl: true,
      isVerified: true,
      _count: { select: { jobs: true } },
    },
  });
}

export async function findCompanyById(id) {
  return prisma.company.findUnique({
    where:  { id },
    select: {
      id: true, name: true, website: true, email: true,
      phone: true, logoUrl: true, description: true, isVerified: true,
      _count: { select: { jobs: true } },
    },
  });
}

export async function findJobsByCompany(companyId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where:   { companyId, isActive: true, isDuplicate: false },
      orderBy: { postedAt: "desc" },
      skip, take: limit,
      select: {
        id: true, title: true, employmentType: true,
        experienceLevel: true, postedAt: true, deadline: true,
        location: { select: { city: true } },
      },
    }),
    prisma.job.count({ where: { companyId, isActive: true, isDuplicate: false } }),
  ]);
  return { jobs, total };
}
