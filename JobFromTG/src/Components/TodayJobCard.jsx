/**
 * TodayJobCard.jsx
 * Specialized card for the Left Column "Today's Posts" section.
 * Layout:
 *   Row 1 — Company icon + Company name (or @channel) + time ago
 *   Row 2 — Job title (large) | Location + Deadline
 *   Row 3 — Description clamped to 3 lines
 *   Row 4 — Apply Now → | Details | Bookmark
 *
 * Rules:
 *   - Only "Details" opens the modal.
 *   - Card itself is NOT clickable for navigation.
 *   - "Apply Now" opens the Telegram link in a new tab.
 *   - Bookmark saves/unsaves the job.
 */

import { useState, useEffect } from "react";
import { BsBriefcaseFill, BsBookmarkFill, BsBookmark } from "react-icons/bs";
import { HiArrowRight, HiLocationMarker, HiCalendar } from "react-icons/hi";
import { useJobContext } from "./JobContext.jsx";

/**
 * Compute a real-time "X mins ago" string from a UTC ISO timestamp.
 *
 * Logic (military time math):
 *   diff_ms  = Date.now() - new Date(isoString).getTime()
 *   diff_min = floor(diff_ms / 60_000)
 *   diff_hr  = floor(diff_ms / 3_600_000)
 *
 * Edge-case: if the stored value is midnight UTC (T00:00:00 or T00:00:00.000Z)
 * the scraper only saved a date with no real clock — show "Today" + the date
 * instead of a misleading "13 hrs ago".
 *
 * Returns a plain string — call this from a stateful hook so it auto-updates.
 */
function timeAgo(isoString) {
  if (!isoString) return "";

  const posted = new Date(isoString);
  if (isNaN(posted.getTime())) return "";

  // Detect date-only stored value: either "YYYY-MM-DD" or "...T00:00:00[.000][Z]"
  // The old scraper saved only the date, resulting in midnight-only timestamps.
  // We detect this from the raw string to avoid timezone ambiguity.
  const str = String(isoString);
  const isMidnightOnly =
    /^\d{4}-\d{2}-\d{2}$/.test(str) ||              // "2026-08-17"
    /T00:00:00(\.000)?(Z|[+-]\d{2}:\d{2})?$/.test(str); // "...T00:00:00" or "...T00:00:00Z"

  const now     = Date.now();
  const diffMs  = now - posted.getTime();
  const diffMin = Math.floor(diffMs  / 60_000);
  const diffHr  = Math.floor(diffMs  / 3_600_000);
  const diffDay = Math.floor(diffMs  / 86_400_000);

  // Future or just posted (within 60 s)
  if (diffMs < 0)     return "Just now";
  if (diffMin < 1)    return "Just now";

  // Suppress misleading "13 hrs ago" for midnight-only timestamps
  if (isMidnightOnly && diffHr >= 1) {
    // Show a human date instead — e.g. "Today" / "Yesterday" / "Aug 15"
    if (diffDay === 0) return "Today";
    if (diffDay === 1) return "Yesterday";
    return posted.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Accurate real-time display
  if (diffMin < 60)  return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr  < 24)  return `${diffHr} hr${diffHr  === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "Yesterday";
  return `${diffDay} days ago`;
}

/** Short formatted deadline — e.g. "Jul 30" */
function formatDeadline(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function TodayJobCard({ job, onViewDetails }) {
  const { addFavorite, removeFromFavorite, isFavorite, getJobKey } = useJobContext();

  const jobKey   = getJobKey(job);
  const favorited = isFavorite(jobKey);

  const toggleFavorite = (e) => {
    e.stopPropagation();
    favorited ? removeFromFavorite(jobKey) : addFavorite(job);
  };

  // Company name — v2 API or v1 saved fallback
  const companyName = job.company?.name || job.company_name || null;

  // Channel username for fallback label
  const channelUsername =
    job.sources?.[0]?.channel?.username ||
    job.channelUsername ||
    null;

  // Location
  const locationLabel =
    job.location?.city ??
    (typeof job.location === "string" ? job.location : null);

  // Deadline
  const deadlineLabel = formatDeadline(job.deadline);

  // Description preview
  const description = job.description
    ? job.description.replace(/\n+/g, " ").trim()
    : "No description available.";

  // Live-ticking posted time — recalculates every 60 s
  const rawPostedAt = job.postedAt || job.posted_at;
  const [postedTime, setPostedTime] = useState(() => timeAgo(rawPostedAt));

  useEffect(() => {
    setPostedTime(timeAgo(rawPostedAt)); // sync on mount / job change
    const id = setInterval(() => setPostedTime(timeAgo(rawPostedAt)), 60_000);
    return () => clearInterval(id);
  }, [rawPostedAt]);

  // Apply link
  const applyLink = job.telegramMessageLink || job.applicationUrl || job.share_link;

  return (
    <div className="today-job-card">

      {/* Row 1 — Company + Time */}
      <div className="tjc-row1">
        <div className="tjc-company-icon">
          <BsBriefcaseFill />
        </div>
        <div className="tjc-company-info">
          {companyName ? (
            <p className="tjc-company-name">{companyName}</p>
          ) : channelUsername ? (
            <p className="tjc-channel-label">From @{channelUsername}</p>
          ) : (
            <p className="tjc-company-name">Unknown Company</p>
          )}
        </div>
        {postedTime && (
          <span className="tjc-time-ago">{postedTime}</span>
        )}
      </div>

      {/* Row 2 — Title + Location / Deadline */}
      <div className="tjc-row2">
        <h3 className="tjc-title">{job.title}</h3>
        <div className="tjc-meta">
          {locationLabel && (
            <span className="tjc-meta-item">
              <HiLocationMarker /> {locationLabel}
            </span>
          )}
          {deadlineLabel && (
            <span className="tjc-meta-item">
              <HiCalendar /> {deadlineLabel}
            </span>
          )}
        </div>
      </div>

      {/* Row 3 — Description */}
      <p className="tjc-description">{description}</p>

      {/* Row 4 — Actions */}
      <div className="tjc-actions">
        <button
          className="tjc-apply-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (applyLink) window.open(applyLink, "_blank");
          }}
        >
          Apply Now
          <HiArrowRight className="arrow-icon" />
        </button>

        <button
          className="tjc-details-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewDetails) onViewDetails(job);
          }}
        >
          Details
        </button>

        <button
          className={`tjc-bookmark-btn ${favorited ? "saved" : ""}`}
          onClick={toggleFavorite}
          title={favorited ? "Remove from saved" : "Save job"}
        >
          {favorited ? <BsBookmarkFill /> : <BsBookmark />}
        </button>
      </div>

    </div>
  );
}

export default TodayJobCard;
