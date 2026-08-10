/**
 * Home.jsx — JobFeed v2 Dashboard
 *
 * Layout:
 *   [Search Row] [Category Pills]
 *   [LEFT 40% — Today's Posts] [RIGHT 60% — This Week / Recent tabs]
 *
 * Left column is sticky with its own scroll.
 * Right column tabs switch between /week and /recent without page reload.
 * Filter sidebar slides in from the left.
 */

import { useState, useEffect, useCallback } from "react";
import JobCard       from "../Components/JobCards.jsx";
import TodayJobCard  from "../Components/TodayJobCard.jsx";
import JobDetail     from "./JobDetail.jsx";
import FilterSidebar from "../Components/FilterSidebar.jsx";
import "../css/Home.css";
import "../css/Dashboard.css";
import {
  getJobs,
  getTodayJobs,
  getWeekJobs,
  getRecentJobs,
  getStats,
} from "../service/api";
import { getJobType, getExperienceLevel } from "../utils/categorize.js";

// ── Category labels ────────────────────────────────────────────
const CATEGORY_LABELS = [
  "All", "Engineering", "Design", "Marketing", "Content",
  "Data Science", "Finance", "HR", "Sales", "Healthcare",
  "Legal", "Operations", "Service", "Education", "NGO",
];

// ── Helper: tag jobs for v1 fallback compatibility ─────────────
function tagJobs(rawJobs) {
  return (rawJobs || []).map((job) => ({
    ...job,
    _job_type:         getJobType(job),
    _experience_level: getExperienceLevel(job),
  }));
}

// ── Loading skeleton components ────────────────────────────────
function TodaySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-today-card" />
      ))}
    </div>
  );
}

function RightSkeleton() {
  return (
    <div className="right-cards-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
function Home() {
  // Filter sidebar
  const [showFilters,       setShowFilters]       = useState(false);

  // Category pill active
  const [activeCategory,    setActiveCategory]    = useState("All");

  // Filter sidebar values
  const [jobTypeFilters,    setJobTypeFilters]    = useState([]);
  const [experienceFilters, setExperienceFilters] = useState([]);
  const [categoryFilters,   setCategoryFilters]   = useState([]);

  // Search
  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchDraft,       setSearchDraft]       = useState("");

  // Today's jobs (left column)
  const [todayJobs,         setTodayJobs]         = useState([]);
  const [todayLoading,      setTodayLoading]      = useState(false);
  const [todayError,        setTodayError]        = useState(null);

  // Right column jobs
  const [rightJobs,         setRightJobs]         = useState([]);
  const [rightLoading,      setRightLoading]      = useState(false);
  const [rightError,        setRightError]        = useState(null);
  const [rightTab,          setRightTab]          = useState("week"); // "week" | "recent"

  // Stats
  const [stats,             setStats]             = useState(null);

  // Reload spinner
  const [reloading,         setReloading]         = useState(false);

  // Modal
  const [selectedJob,       setSelectedJob]       = useState(null);

  // ── Fetch Today's Jobs ───────────────────────────────────────
  const fetchToday = useCallback(async () => {
    setTodayLoading(true);
    setTodayError(null);
    try {
      const data = await getTodayJobs(100);
      setTodayJobs(tagJobs(data || []));
    } catch (err) {
      console.error("[Today]", err);
      setTodayError("Could not load today's jobs.");
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // ── Fetch Right Column Jobs ──────────────────────────────────
  const fetchRight = useCallback(async (tab) => {
    setRightLoading(true);
    setRightError(null);
    try {
      let data;
      if (tab === "week") {
        data = await getWeekJobs(100);
      } else {
        data = await getRecentJobs(14, 100);
      }
      setRightJobs(tagJobs(data || []));
    } catch (err) {
      console.error("[Right]", err);
      setRightError("Could not load jobs.");
    } finally {
      setRightLoading(false);
    }
  }, []);

  // ── Fetch Stats ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error("[Stats]", err);
    }
  }, []);

  // ── Search ───────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchDraft.trim()) return;
    setRightLoading(true);
    setRightError(null);
    setSearchQuery(searchDraft);
    try {
      const { jobs } = await getJobs({ q: searchDraft, limit: 100 });
      setRightJobs(tagJobs(jobs || []));
    } catch (err) {
      console.error("[Search]", err);
      setRightError("Search failed.");
    } finally {
      setRightLoading(false);
    }
  };

  // ── Reload (clear search, reload all) ───────────────────────
  const handleReload = async () => {
    setSearchQuery("");
    setSearchDraft("");
    setReloading(true);
    await Promise.all([fetchToday(), fetchRight(rightTab), fetchStats()]);
    setReloading(false);
  };

  // ── Tab switch ───────────────────────────────────────────────
  const switchTab = (tab) => {
    if (tab === rightTab) return;
    setRightTab(tab);
    setSearchQuery("");
    setSearchDraft("");
    fetchRight(tab);
  };

  // ── Filter toggles ───────────────────────────────────────────
  const toggleJobType    = (t) => setJobTypeFilters(  (p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);
  const toggleExperience = (l) => setExperienceFilters((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);
  const toggleCategory   = (c) => setCategoryFilters(  (p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);
  const resetFilters     = ()  => { setJobTypeFilters([]); setExperienceFilters([]); setCategoryFilters([]); };

  // ── Client-side filtering for right column ───────────────────
  const filteredRightJobs = rightJobs.filter((job) => {
    const jobCat  = job.category?.name || job._category || "Other";
    const jobType = getJobType(job);
    const jobExp  = getExperienceLevel(job);

    const catMatch =
      activeCategory === "All" ||
      jobCat.toLowerCase() === activeCategory.toLowerCase();

    const typeMatch = jobTypeFilters.length === 0 || jobTypeFilters.includes(jobType);
    const expMatch  = experienceFilters.length === 0 || experienceFilters.includes(jobExp);

    return catMatch && typeMatch && expMatch;
  });

  // ── Client-side filtering for today's column ─────────────────
  const filteredTodayJobs = todayJobs.filter((job) => {
    const jobCat = job.category?.name || job._category || "Other";
    const catMatch =
      activeCategory === "All" ||
      jobCat.toLowerCase() === activeCategory.toLowerCase();
    return catMatch;
  });

  // ── Initial data load ─────────────────────────────────────────
  useEffect(() => {
    fetchToday();
    fetchRight("week");
    fetchStats();
  }, [fetchToday, fetchRight, fetchStats]);

  const activeFilterCount =
    jobTypeFilters.length + experienceFilters.length + categoryFilters.length;

  // ── Total badge count ─────────────────────────────────────────
  const totalCount = stats
    ? rightTab === "week"
      ? stats.weekJobs
      : stats.recentJobs
    : filteredRightJobs.length;

  return (
    <>
      {/* ── Filter Sidebar ──────────────────────────────── */}
      <FilterSidebar
        open={showFilters}
        onClose={() => setShowFilters(false)}
        jobTypeFilters={jobTypeFilters}
        experienceFilters={experienceFilters}
        categoryFilters={categoryFilters}
        onToggleJobType={toggleJobType}
        onToggleExperience={toggleExperience}
        onToggleCategory={toggleCategory}
        onReset={resetFilters}
      />

      <div className="dashboard-page">

        {/* ── Search Row ──────────────────────────────── */}
        <form className="dashboard-search-row" onSubmit={handleSearch}>
          {/* Filter trigger button */}
          <button
            type="button"
            className="filter-trigger-btn"
            onClick={() => setShowFilters(true)}
          >
            ☰ Filters
            {activeFilterCount > 0 && (
              <span className="filter-trigger-badge">{activeFilterCount}</span>
            )}
          </button>

          {/* Search input */}
          <div className="dashboard-search-wrap">
            <span className="dashboard-search-icon">🔍</span>
            <input
              className="dashboard-search-input"
              type="text"
              placeholder="Search for jobs..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

          {/* Reload button */}
          <button
            type="button"
            className={`dashboard-reload-btn ${reloading ? "spinning" : ""}`}
            onClick={handleReload}
            title="Reload jobs"
          >
            ↻ Reload
          </button>
        </form>

        {/* ── Category Pills ──────────────────────────── */}
        <div className="category-pills-row">
          <div className="category-pills-inner">
            {CATEGORY_LABELS.map((cat) => (
              <button
                key={cat}
                className={`category-pill ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Dashboard Two-Column Body ────────────────── */}
        <div className="dashboard-body">

          {/* ── LEFT — Today's Posts ──────────────────── */}
          <div className="dashboard-left">
            <div className="section-header">
              <span className="section-title">Today's Posts</span>
              <span className="section-badge today">
                {todayLoading ? "…" : `${filteredTodayJobs.length} Jobs`}
              </span>
            </div>

            {todayError && (
              <div className="dashboard-error">{todayError}</div>
            )}

            {todayLoading ? (
              <TodaySkeleton />
            ) : filteredTodayJobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h4>No jobs posted today</h4>
                <p>Check back later or browse recent posts →</p>
              </div>
            ) : (
              <div className="today-cards-list">
                {filteredTodayJobs.map((job) => (
                  <TodayJobCard
                    key={job.telegramMessageLink || job.id}
                    job={job}
                    onViewDetails={setSelectedJob}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT — This Week / Recent ────────────── */}
          <div className="dashboard-right">
            {/* Tab switcher + total badge */}
            <div className="right-tabs">
              <button
                className={`right-tab-btn ${rightTab === "week" ? "active" : ""}`}
                onClick={() => switchTab("week")}
              >
                This Week
              </button>
              <button
                className={`right-tab-btn ${rightTab === "recent" ? "active" : ""}`}
                onClick={() => switchTab("recent")}
              >
                Recent
              </button>
              {searchQuery && (
                <span style={{ fontSize: "0.78rem", color: "#888", alignSelf: "center" }}>
                  Results for &quot;{searchQuery}&quot;
                </span>
              )}
              <span className="right-tab-total">
                {rightLoading
                  ? "…"
                  : searchQuery
                  ? `${filteredRightJobs.length} results`
                  : `${totalCount ?? filteredRightJobs.length} Jobs`}
              </span>
            </div>

            {rightError && (
              <div className="dashboard-error">{rightError}</div>
            )}

            {rightLoading ? (
              <RightSkeleton />
            ) : filteredRightJobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔎</div>
                <h4>No jobs found</h4>
                <p>Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="right-cards-grid">
                {filteredRightJobs.map((job) => (
                  <JobCard
                    key={job.telegramMessageLink || job.id}
                    job={job}
                    onViewDetails={setSelectedJob}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Job Detail Modal ──────────────────────────── */}
      {selectedJob && (
        <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </>
  );
}

export default Home;
