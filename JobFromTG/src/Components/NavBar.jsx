import { Link } from "react-router-dom";
import "../css/Navbar.css";
import { MdBookmark } from "react-icons/md";
import { FaArrowLeft } from "react-icons/fa6";
import LogoImg from "../assets/logo.png";

function Navbar() {
  const returnBack = () => {
    window.history.back();
    document.querySelector(".back-button").style.display = "none";
  };
  const savedBtn = () => {
    document.querySelector(".back-button").style.display = "flex";
  };
  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <img src={LogoImg} alt="Logo" className="navbar-logo" />
          <div className="navbar-brand-text">
            <span className="brand-text">JobFeed</span>
            <span className="navbar-subtitle">
              Find verified opportunities from Ethiopian Telegram channels.
            </span>
          </div>
        </Link>

        <div className="navbar-links">
          <Link to="/" className="back-button" onClick={returnBack}>
            <FaArrowLeft size={20} />
          </Link>
          <Link to="/favorite" className="nav-link" onClick={savedBtn}>
            <MdBookmark className="nav-icon" /><span className="nav-link-text"> SAVED JOBS</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
export default Navbar;
