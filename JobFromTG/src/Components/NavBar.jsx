import { Link } from "react-router-dom";
import "../css/Navbar.css";
import { MdBookmark } from "react-icons/md";
import LogoImg from "../assets/logo.png";

function Navbar() {
  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <img src={LogoImg} alt="Logo" className="navbar-logo" />
          <div className="navbar-brand-text">
            <span className="brand-text">JobFeed</span>
            <span className="navbar-subtitle">Find verified opportunities from Ethiopian Telegram channels.</span>
          </div>
        </Link>

        <div className="navbar-links">
          <Link to="/favorite" className="nav-link">
            <MdBookmark className="nav-icon" /> Saved Jobs
          </Link>
        </div>
      </nav>
    </div>
  );
}
export default Navbar;
