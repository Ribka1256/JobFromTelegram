// JobCard.jsx
import { useNavigate } from 'react-router-dom';
import { useJobContext } from '../Components/JobContext.jsx';
import '../css/JobCard.css';
import { FaBookmark, FaSearch, FaHeart } from "react-icons/fa";
import { BsBookmarkFill, BsHeartFill } from "react-icons/bs";
import { MdHome, MdBookmark } from "react-icons/md";
function JobCard({ job, onViewDetails }) {
  const navigate = useNavigate();
  const { addFavorite, removeFromFavorite, isFavorite, getJobKey } = useJobContext();

  const jobKey = getJobKey(job);
  const favorited = isFavorite(jobKey);

  const toggleFavorite = (e) => {
    e.stopPropagation();
    favorited ? removeFromFavorite(jobKey) : addFavorite(job);
  };

  return (
    <div className="job-card">
      <div className="job-poster">
        {job.image ? <img src={job.image} alt={job.title} /> : (
          <div className="poster-placeholder">{job.company_name?.[0] || "J"}</div>
        )}
        <button
          className={`favorite-btn ${favorited ? "active" : ""}`}
          onClick={toggleFavorite}
        >Saved
          {favorited ? <BsBookmarkFill /> : <MdBookmark />}
        </button>
      </div>

      <div className="job-info">
        <h3>{job.title}</h3>
       <div className="job-meta">
  <div>
    <strong>Posted At</strong>
    <span>{job.posted_at}</span>
  </div>
  <div>
    <strong>Location</strong>
    <span>{job.location}</span>
  </div>
  <div>
    <strong>Deadline</strong>
    <span>{job.deadline}</span>
  </div>
</div>
        </div>
       <p
  className="detail-link"
  onClick={() => onViewDetails(job)}
>
  {job.description.match(/Description:\s*([\s\S]*?)\n\n[A-Z].*/)?.[1] || "No description"}
</p>
<div className="job-actions">
        <button
          className="apply-btn"
    onClick={() => {
  if (job.share_link) {
    window.open(job.share_link, "_blank");
  } else {
    navigate('/apply', { state: { job } });
  }
}}
>
          Apply Now
        </button>
        </div>
      </div>
  );
}
export default JobCard;