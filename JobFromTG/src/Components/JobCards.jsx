// JobCard.jsx
import { useNavigate } from 'react-router-dom';
import { useJobContext } from '../Components/JobContext.jsx';
import '../css/JobCard.css';

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
        >
          {favorited ? "❤️" : "🤍"}
        </button>
      </div>

      <div className="job-info">
        <h3>{job.title}</h3>
        <p className="company">{job.company_name}</p>

        <div className="job-meta">
          <span className="location">📍 {job.location}</span>
          {job.salary_range && <span className="salary">💲 {job.salary_range}</span>}
        </div>

        <button
          className="detail-link"
          onClick={() => onViewDetails(job)}
        >
          Job Description →
        </button>

        <button
          className="apply-btn"
           onClick={() => {
    if (job.share_link) {
     const tgWeb = job.share_link;
      const parts = tgWeb.replace("https://t.me/", "").split("/");
      const channel = parts[0];
      const postId = parts[1];
     if (channel && postId) {
        window.location.href = `tg://resolve?domain=${channel}&post=${postId}`;
        setTimeout(() => {
          window.open(tgWeb, "_blank");
        }, 2000);
      } else {
        window.open(tgWeb, "_blank");
      }
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