// JobContext.jsx
import { createContext, useState, useContext, useEffect } from "react";

const JobContext = createContext();

export const useJobContext = () => useContext(JobContext);

// Helper: get a stable unique identifier for a job,
// even if the API doesn't return an `id` field.
const getJobKey = (job) =>
  job.id || job.share_link || `${job.title}-${job.company_name}-${job.posted_at}`;

export const JobProvider = ({ children }) => {
  const [favorite, setFavorite] = useState([]);

  useEffect(() => {
    const storedFavs = localStorage.getItem("favorites");
    if (storedFavs) {
      setFavorite(JSON.parse(storedFavs));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorite));
  }, [favorite]);

  const addFavorite = (job) => {
    setFavorite((prev) => {
      if (prev.some((j) => getJobKey(j) === getJobKey(job))) return prev; // avoid duplicates
      return [...prev, job];
    });
  };

  const removeFromFavorite = (jobKey) => {
    setFavorite((prev) => prev.filter((job) => getJobKey(job) !== jobKey));
  };

  const isFavorite = (jobKey) => {
    return favorite.some((job) => getJobKey(job) === jobKey);
  };

  const value = {
    favorite,
    addFavorite,
    removeFromFavorite,
    isFavorite,
    getJobKey,
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};