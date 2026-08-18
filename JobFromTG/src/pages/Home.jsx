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
 *
 * Auto-refresh: polls /api/v1/stats every 5 minutes.
 * If totalJobs has changed, silently re-fetches both job columns.
 * No manual Reload button — the Python scheduler handles scraping.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import JobCard       from "../Components/JobCards.jsx";
import TodayJobCard  from "../Components/TodayJobCard.jsx";
import JobDetail     from "./JobDetail.jsx";
import FilterSidebar from "../Components/FilterSidebar.jsx";
import { HiSearch, HiFilter, HiChevronDown } from "react-icons/hi";
import "../css/Home.css";
import "../css/Dashboard.css";
import {
  getJobs,
  getTodayJobs,
  getWeekJobs,
  getStats,
} from "../service/api";
import { getJobType, getExperienceLevel } from "../utils/categorize.js";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

  // Mobile accordion
  const [todayOpen,         setTodayOpen]         = useState(true);
  const [last5Open,         setLast5Open]         = useState(true);

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

  // Stats
  const [stats,             setStats]             = useState(null);

  // Ref tracking last known totalJobs count for silent auto-refresh detection
  const lastTotalJobsRef = useRef(null);

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

  // ── Fetch Right Column Jobs (yesterday → 5 days back) ────────
  const fetchRight = useCallback(async () => {
    setRightLoading(true);
    setRightError(null);
    try {
      const data = await getWeekJobs(200);

      // UTC midnight of today — timezone-safe cutoff
      const n = new Date();
      const todayCutoff = new Date(Date.UTC(
        n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()
      ));

      // Exclude any job whose UTC calendar date is today.
      // Normalise strings that lack a timezone suffix (treat them as UTC).
      const pastOnly = (data || []).filter((job) => {
        const raw = job.postedAt || job.posted_at;
        if (!raw) return true;
        const hasOffset = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw);
        const parsed = new Date(hasOffset ? raw : raw + "Z");
        return parsed < todayCutoff;
      });

      setRightJobs(tagJobs(pastOnly));
    } catch (err) {
      console.error("[Right]", err);
      setRightError("Could not load jobs.");
    } finally {
      setRightLoading(false);
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

  // ── Initial data load ──────────────────────────────────
  useEffect(() => {
    fetchToday();
    fetchRight();
  }, [fetchToday, fetchRight]);

  // ── Auto-poll: check for new jobs every 5 minutes ──────
  // Compares totalJobs from /stats; silently re-fetches if count changed.
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getStats();
        if (!data) return;
        setStats(data);
        const newTotal = data.totalJobs ?? 0;
        if (
          lastTotalJobsRef.current !== null &&
          newTotal !== lastTotalJobsRef.current
        ) {
          // New jobs arrived — silently refresh both feed columns
          fetchToday();
          fetchRight();
        }
        lastTotalJobsRef.current = newTotal;
      } catch {
        // Silent — never disrupt the UX
      }
    };

    poll(); // run immediately to set baseline + initial stats
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchToday, fetchRight]);

  const activeFilterCount =
    jobTypeFilters.length + experienceFilters.length + categoryFilters.length;

  // ── Total badge count ─────────────────────────────────────────
  const totalCount = stats?.weekJobs ?? filteredRightJobs.length;

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
            <HiFilter className="filter-icon" />
            <span className="filter-btn-text">FILTERS</span>
            {activeFilterCount > 0 && (
              <span className="filter-trigger-badge">{activeFilterCount}</span>
            )}
          </button>

          {/* Search input */}
          <div className="dashboard-search-wrap">
            <span className="dashboard-search-icon">
              <HiSearch className="search-icon"/>
            </span>
            <input
              className="dashboard-search-input"
              type="text"
              placeholder="Search for jobs..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

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
            {/* Section header — doubles as mobile accordion toggle */}
            <div
              className="section-header"
              onClick={() => setTodayOpen((p) => !p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setTodayOpen((p) => !p)}
            >
              <span className="section-title">TODAY'S POST</span>
              <span className="section-badge today">
                {todayLoading ? "…" : `${filteredTodayJobs.length} Jobs`}
              </span>
              <HiChevronDown
                className={`mobile-chevron ${todayOpen ? "open" : ""}`}
              />
            </div>

            {/* Collapsible body — always visible on desktop via CSS */}
            <div className={`mobile-section-body ${todayOpen ? "open" : ""}`}>
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
          </div>

          {/* ── RIGHT — Last 5 Days ───────────────── */}
          <div className="dashboard-right">
            {/* Right tabs — doubles as mobile accordion toggle */}
            <div
              className="right-tabs"
              onClick={() => setLast5Open((p) => !p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setLast5Open((p) => !p)}
            >
              <span className="right-tab-btn active">
                Past 5 Days
              </span>
              <span className="right-tab-sub">
                (yesterday &amp; before)
              </span>
              {searchQuery && (
                <span style={{ fontSize: "0.78rem", color: "#888", alignSelf: "center" }}>
                  Results for &quot;{searchQuery}&quot;
                </span>
              )}
              <HiChevronDown
                className={`mobile-chevron ${last5Open ? "open" : ""}`}
              />
              <span className="right-tab-total">
                {rightLoading
                  ? "…"
                  : searchQuery
                  ? `${filteredRightJobs.length} results`
                  : `${totalCount ?? filteredRightJobs.length} Jobs`}
              </span>
            </div>

            {/* Collapsible body — always visible on desktop via CSS */}
            <div className={`mobile-section-body ${last5Open ? "open" : ""}`}>
              {rightError && (
                <div className="dashboard-error">{rightError}</div>
              )}

              {rightLoading ? (
                <RightSkeleton />
              ) : filteredRightJobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">{searchQuery ? "🔎" : "📅"}</div>
                  <h4>{searchQuery ? "No jobs found" : "No posts from the past 5 days"}</h4>
                  <p>
                    {searchQuery
                      ? "Try adjusting your filters or search terms."
                      : "Today's new posts are shown on the left. Yesterday's jobs will appear here once the scheduler has run on multiple days."}
                  </p>
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

      </div>

      {/* ── Job Detail Modal ──────────────────────────── */}
      {selectedJob && (
        <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </>
  );
}

export default Home;
