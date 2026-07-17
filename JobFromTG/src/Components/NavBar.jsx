import { Link } from "react-router-dom";
import '../css/Navbar.css';
import { MdBookmark } from "react-icons/md";
import { HiMenu } from "react-icons/hi";
import { useFilter } from "../Components/FilterContext";

function Navbar() {
  const { setShowFilters } = useFilter();

  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <button className="filter-hamburger" onClick={() => setShowFilters(true)}>
          <HiMenu size={30} />
        </button>

        <Link to="/" className="navbar-brand">
          <img src="src/assets/logo.png" alt="Logo" className="navbar-logo" />
          <span className="brand-text">JobFeed</span>
        </Link>

        <div className="navbar-links">
          <Link to="/favorite" className="nav-link"><MdBookmark className="nav-icon" /> SAVED POST</Link>
        </div>
      </nav>
    </div>
  );
}
export default Navbar;