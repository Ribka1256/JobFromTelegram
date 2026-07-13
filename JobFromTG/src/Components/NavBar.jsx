// Navbar.jsx
import { Link } from "react-router-dom";
import '../css/Navbar.css';
import { FaBriefcase } from "react-icons/fa";
import { BsBriefcaseFill } from "react-icons/bs";
import { BsBookmarkFill, BsHeartFill } from "react-icons/bs";
import { MdHome, MdBookmark } from "react-icons/md";
function Navbar() {
  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
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