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
          <HiMenu size={20} /> Filter
        </button>

        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🏢</span>
          JobSearch
        </Link>

        <div className="navbar-links">
          <Link to="/favorite" className="nav-link"><MdBookmark /> Saved post</Link>
        </div>
      </nav>
    </div>
  );
}
export default Navbar;