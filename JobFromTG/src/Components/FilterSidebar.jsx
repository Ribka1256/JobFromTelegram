import { useEffect, useRef } from "react";
import { HiX, HiSearch } from "react-icons/hi";
import "../css/FilterSidebar.css";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Remote", "Internship", "Freelance"];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior", "Lead", "Executive"];
const CATEGORIES = [
  "Engineering", "Design", "Marketing", "Content",
  "Data Science", "Finance", "HR", "Sales",
  "Healthcare", "Legal", "Operations", "Service", "Education", "NGO",
];

function FilterSidebar({
  open,
  onClose,
  jobTypeFilters,
  experienceFilters,
  categoryFilters,
  onToggleJobType,
  onToggleExperience,
  onToggleCategory,
  onReset,
}) {
  const sidebarRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeCount =
    jobTypeFilters.length + experienceFilters.length + categoryFilters.length;

  return (
    <>
      {open && <div className="fsb-backdrop" onClick={onClose} />}
      <aside ref={sidebarRef} className={`fsb-sidebar ${open ? "open" : ""}`}>
        {/* Header */}
        <div className="fsb-header">
          <div className="fsb-header-left">
            <span className="fsb-title">Filters</span>
            {activeCount > 0 && (
              <span className="fsb-active-badge">{activeCount}</span>
            )}
          </div>
          <div className="fsb-header-right">
            {activeCount > 0 && (
              <button className="fsb-clear-btn" onClick={onReset}>Clear all</button>
            )}
            <button className="fsb-close-btn" onClick={onClose}>
              <HiX size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="fsb-body">

          {/* Category */}
          <div className="fsb-group">
            <p className="fsb-group-label">CATEGORY</p>
            <div className="fsb-pill-grid">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`fsb-pill ${categoryFilters.includes(cat) ? "active" : ""}`}
                  onClick={() => onToggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Employment Type */}
          <div className="fsb-group">
            <p className="fsb-group-label">JOB TYPE</p>
            {EMPLOYMENT_TYPES.map((t) => (
              <label key={t} className="fsb-check-row">
                <input
                  type="checkbox"
                  className="fsb-checkbox"
                  checked={jobTypeFilters.includes(t)}
                  onChange={() => onToggleJobType(t)}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>

          {/* Experience Level */}
          <div className="fsb-group">
            <p className="fsb-group-label">EXPERIENCE LEVEL</p>
            {EXPERIENCE_LEVELS.map((l) => (
              <label key={l} className="fsb-check-row">
                <input
                  type="checkbox"
                  className="fsb-checkbox"
                  checked={experienceFilters.includes(l)}
                  onChange={() => onToggleExperience(l)}
                />
                <span>{l}</span>
              </label>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="fsb-footer">
          <button className="fsb-apply-btn" onClick={onClose}>
            Apply Filters
          </button>
        </div>
      </aside>
    </>
  );
}

export default FilterSidebar;
