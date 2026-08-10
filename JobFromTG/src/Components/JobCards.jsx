// JobCard.jsx — v2
// Updated for dashboard redesign:
//  - Added "Details" button alongside "Apply Now"
//  - Removed card-level click for details (only Details button opens modal)
//  - company_name and description are pre-structured fields from the API.
//  - The card now reads job.company?.name (v2) with fallback to job.company_name (v1 saved jobs).

import { useJobContext } from "../Components/JobContext.jsx";
import "../css/JobCard.css";
import { BsBriefcaseFill, BsBookmarkFill } from "react-icons/bs";
import { HiArrowRight } from "react-icons/hi";

function JobCard({ job, onViewDetails }) {
  const { addFavorite, removeFromFavorite, isFavorite, getJobKey } = useJobContext();

  const jobKey    = getJobKey(job);
  const favorited = isFavorite(jobKey);

  const toggleFavorite = (e) => {
    e.stopPropagation();
    favorited ? removeFromFavorite(jobKey) : addFavorite(job);
  };

  // v2 API returns job.company.name; v1 saved jobs have job.company_name
  const companyName = job.company?.name || job.company_name || "Unknown Company";

  // v2 API returns structured description; show a clean 160-char preview
  const descriptionPreview = job.description
    ? job.description.replace(/\n+/g, " ").trim().slice(0, 160) + (job.description.length > 160 ? "…" : "")
    : "No description available.";

  // v2 API returns job.location as {city,country}; v1 has it as a plain string
  const locationLabel = job.location?.city ?? (typeof job.location === "string" ? job.location : "Ethiopia");

  // v2 API returns job.category as {id,name,slug,...}; v1 has it as a plain string
  const categoryLabel = job.category?.name ?? (typeof job.category === "string" ? job.category : null);

  return (
    <div className="job-card">
      <div className="job-poster">
        <div className="briefcase-icon">
          <BsBriefcaseFill className="Icon" />
        </div>
        <p className="job">{companyName}</p>
        <button
          className={`favorite-btn ${favorited ? "active" : ""}`}
          onClick={toggleFavorite}
        >
          {favorited ? "SAVED" : "SAVE"}
          <BsBookmarkFill />
        </button>
      </div>

      <div className="job-info">
        <h3>{job.title}</h3>
        {categoryLabel && <span className="job-category-badge">{categoryLabel}</span>}
        <div className="job-meta">
          <div>
            <strong>Posted</strong>
            <span>
              {job.postedAt
                ? new Date(job.postedAt).toLocaleDateString()
                : job.posted_at || "—"}
            </span>
          </div>
          <div>
            <strong>Location</strong>
            <span>{locationLabel}</span>
          </div>
          <div>
            <strong>Deadline</strong>
            <span>
              {job.deadline
                ? new Date(job.deadline).toLocaleDateString()
                : job.deadline_raw || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Description — clamped, NOT clickable for modal */}
      <p className="detail-link">
        {descriptionPreview}
      </p>

      <div className="job-actions">
        <button
          className="apply-btn"
          onClick={(e) => {
            e.stopPropagation();
            const link = job.telegramMessageLink || job.share_link;
            if (link) window.open(link, "_blank");
          }}
        >
          Apply Now
          <HiArrowRight className="arrow-icon" />
        </button>

        {/* Details button — the ONLY way to open the modal */}
        {onViewDetails && (
          <button
            className="details-btn"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(job);
            }}
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
}

export default JobCard;
