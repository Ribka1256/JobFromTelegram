const BASE_URL = "http://localhost:5000/jobs";

export const getJobs = async () => {
  const response = await fetch(BASE_URL);
  if (!response.ok) throw new Error("Failed to fetch jobs");
  return await response.json();
};

export const searchJobs = async (query) => {
  const response = await fetch(`${BASE_URL}?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Failed to fetch jobs");
  return await response.json();
};
