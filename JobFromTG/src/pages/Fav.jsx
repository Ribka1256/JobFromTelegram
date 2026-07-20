import JobCards from '../Components/JobCards.jsx'
import { useJobContext } from '../Components/JobContext.jsx'
import '../css/Favorites.css'
function Fav() {
  const { favorite, getJobKey } = useJobContext();

  return (
    <div className="favorite">
      <h2 className='h2'>SAVED POSTS</h2>
      {favorite.length === 0 ? (
        <p>No favorite jobs yet.</p>
      ) : (
        <div className="movies-grid">
          {favorite.map((job) => (
            <JobCards key={getJobKey(job)} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Fav;