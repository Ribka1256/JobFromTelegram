import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../css/Apply.css';

function Apply() {
  const { state } = useLocation();
  const job = state?.job;
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [file2, setFile2] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    education: "degree",
    company_name: "",
    job_title: "",
    employment_date: "",
    achievement: "",
    skills: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:5000/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          job_applied: job?.title || "N/A",
          company_applied: job?.company_name || "N/A",
          resume: file?.name || "Not uploaded",
          certification: file2?.name || "Not uploaded",
        }),
      });

      if (!response.ok) throw new Error("Failed to submit");

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Failed to send application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (submitted) {
    return (
      <div className="apply-page">
        <div className="apply-success">
          <div className="success-icon">✅</div>
          <h2>Application Submitted!</h2>
          <p>Your application for <strong>{job?.title}</strong> at <strong>{job?.company_name}</strong> has been sent.</p>
          <p>We'll be in touch at <strong>{form.email}</strong>.</p>
          <button onClick={() => navigate("/")}>Back to Jobs</button>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-page">
      {/* Sidebar */}
      <aside className="filter-sidebar">
        <div className="filter-header">
          <h4>📄 Job Summary</h4>
        </div>

        {job ? (
          <div className="filter-group">
            <h5>POSITION</h5>
            <p className="job-title">{job.title}</p>
            <p className="job-company">{job.company_name}</p>
            {job.location && <p className="job-meta">📍 {job.location}</p>}
            {job.salary_range && <p className="job-meta">💲 {job.salary_range}</p>}
          </div>
        ) : (
          <div className="filter-group">
            <p className="job-meta">No job selected</p>
          </div>
        )}

        <div className="filter-group">
          <h5>APPLICATION CHECKLIST</h5>
          <label><input type="checkbox" checked={!!file} readOnly /> Resume/CV uploaded</label>
          <label><input type="checkbox" checked={!!file2} readOnly /> Certification uploaded</label>
        </div>
      </aside>

      {/* Main form */}
      <div className="apply-form-container">
        <h1>Application Form</h1>

        <form onSubmit={handleSubmit}>
          <section className="form-section">
            <h3>Personal Information</h3>
            <div className="form-row">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                placeholder="Full Name..."
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="Your Email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-row">
              <label>Phone</label>
              <input
                type="number"
                name="phone"
                placeholder="+251"
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            <div className="form-row">
              <label>Birth Date</label>
              <input
                type="date"
                name="birth_date"
                value={form.birth_date}
                onChange={handleChange}
              />
            </div>
          </section>

          <section className="form-section">
            <h3>Resume/CV</h3>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            {file && <p className="file-name">Selected file: {file.name}</p>}
          </section>

          <section className="form-section">
            <h3>Education</h3>
            <select
              name="education"
              value={form.education}
              onChange={handleChange}
              required
            >
              <option value="high">High School</option>
              <option value="degree">Degree</option>
              <option value="master">Masters</option>
              <option value="phd">PHD</option>
            </select>
          </section>

          <section className="form-section">
            <h3>Work Experience (If there is one)</h3>
            <div className="form-row">
              <label>Company Name</label>
              <input
                type="text"
                name="company_name"
                placeholder="Company Name..."
                value={form.company_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-row">
              <label>Job Title</label>
              <input
                type="text"
                name="job_title"
                placeholder="Job Title..."
                value={form.job_title}
                onChange={handleChange}
              />
            </div>
            <div className="form-row">
              <label>Employment Date</label>
              <input
                type="text"
                name="employment_date"
                placeholder="Employment date..."
                value={form.employment_date}
                onChange={handleChange}
              />
            </div>
            <div className="form-row">
              <label>Achievement</label>
              <textarea
                name="achievement"
                rows="5"
                placeholder="Achievement..."
                value={form.achievement}
                onChange={handleChange}
              />
            </div>
          </section>

          <section className="form-section">
            <h3>Skills</h3>
            <p className="hint">Enter any additional skills</p>
            <textarea
              name="skills"
              rows="5"
              placeholder="Skills..."
              value={form.skills}
              onChange={handleChange}
            />
          </section>

          <section className="form-section">
            <h3>Certifications</h3>
            <p className="hint">Upload if you have any certification</p>
            <input type="file" onChange={(e) => setFile2(e.target.files[0])} />
            {file2 && <p className="file-name">Selected file: {file2.name}</p>}
          </section>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Sending..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Apply;