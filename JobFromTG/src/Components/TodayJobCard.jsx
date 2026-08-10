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

import { BsBriefcaseFill, BsBookmarkFill, BsBookmark } from "react-icons/bs";
import { HiArrowRight, HiLocationMarker, HiCalendar } from "react-icons/hi";
import { useJobContext } from "./JobContext.jsx";

/** Format a date into a short human "time ago" string. */
function timeAgo(date) {
  if (!date) return "";
  const now  = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins  < 1)   return "Just now";
  if (mins  < 60)  return `${mins} min${mins === 1 ? "" : "s"} ago`;
  if (hours < 24)  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  if (days  === 1) return "Yesterday";
  return `${days} days ago`;
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

  // Posted time
  const postedTime = timeAgo(job.postedAt || job.posted_at);

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
