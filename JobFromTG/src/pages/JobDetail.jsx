import { useNavigate, useLocation } from "react-router-dom";
import { useJobContext } from "../Components/JobContext.jsx";
import { HiArrowRight, HiX, HiCalendar, HiLocationMarker } from "react-icons/hi";
import { FaBriefcase } from "react-icons/fa";
import { BsBookmarkFill } from "react-icons/bs";
import "../css/JobDetail.css";

function JobDetail({ job: jobProp, onClose }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const job = jobProp || state?.job;
  const { addFavorite, removeFromFavorite, isFavorite, getJobKey } = useJobContext();

  const handleClose = () => {
    if (onClose) onClose();
    else navigate(-1);
  };

  if (!job) {
    return (
      <div className="job-detail-empty">
        <p>No job is selected</p>
        <button onClick={() => navigate("/")}>Back to listings</button>
      </div>
    );
  }

  const jobKey = getJobKey(job);
  const saved = isFavorite(jobKey);
  const toggleSave = () => {
    saved ? removeFromFavorite(jobKey) : addFavorite(job);
  };

  return (
    <div className="job-detail-overlay" onClick={handleClose}>
      <div className="job-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="jd-header">
          <div className="jd-company">
            <div className="jd-icon-container"><FaBriefcase className = "jd-icon" /></div>
            <div>
              <p className="jd-company-name">{(job.company?.name || job.company_name || "Company").toUpperCase()}</p>
              <p className="jd-category">{job.category?.name ?? (typeof job.category === "string" ? job.category : "Other")}</p>
            </div>
          </div>
          <button className="jd-close" onClick={handleClose}>
            <HiX />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="jd-body">
          <h1 className="jd-title">{job.title}</h1>

          <div className="jd-meta-pills">
            {(job.location?.city || job.location) && <span className="jd-pill"><HiLocationMarker style={{ fontSize: '1rem' }} /> {job.location?.city || job.location}</span>}
            {(job.salaryRaw || job.salary_range) && <span className="jd-pill">💲 {job.salaryRaw || job.salary_range}</span>}
            {(job.postedAt || job.posted_at) && <span className="jd-pill"><HiCalendar style={{ fontSize: '1rem' }} /> {new Date(job.postedAt || job.posted_at).toLocaleDateString()}</span>}
          </div>

          <div className="jd-divider" />

          <div className="jd-two-col">
            <div>
              <p className="jd-label">POSITION TYPE</p>
              <p className="jd-value">{job.employmentType || job.position_type || "Full-time"}</p>
            </div>
            <div>
              <p className="jd-label">REQUIRED EXPERIENCE</p>
              <p className="jd-value">{job.experienceLevel || job.experience_level || "Not specified"}</p>
            </div>
          </div>

          <div className="jd-divider" />

          <section>
            <p className="jd-label">ROLE OVERVIEW</p>
            <p className="jd-text">{job.description}</p>
          </section>

          <section>
            <p className="jd-label">CORE REQUIREMENTS</p>
            <ul className="jd-checklist">
              {(job.requirements || []).map((req, i) => (
                <li key={i}>
                  <span className="jd-check">✓</span> {req}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="jd-label">COMPENSATION &amp; BENEFITS</p>
            <div className="jd-benefits-grid">
              {(job.benefits || []).map((b, i) => (
                <div className="jd-benefit-card" key={i}>
                  <span className="jd-benefit-icon">✨</span>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="jd-label">ASSOCIATED SKILLS</p>
            <div className="jd-skills">
              {(job.skills || []).map((skill, i) => (
                <span className="jd-skill-tag" key={i}>{skill?.name || skill}</span>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="jd-footer">
          <button className={`jd-save-btn ${saved ? 'active' : ''}`} onClick={toggleSave}>
            {saved ? "SAVED" : "SAVE"}
            <BsBookmarkFill className="jd-bookmark-icon" />
          </button>
          <button
            className="jd-apply-btn"
            onClick={() => {
              const link = job.telegramMessageLink || job.applicationUrl || job.share_link;
              if (link) window.open(link, "_blank");
              else navigate('/apply', { state: { job } });
            }}
          >
            APPLY NOW <HiArrowRight className="jd-arrow-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default JobDetail;