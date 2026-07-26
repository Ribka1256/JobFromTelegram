import { Link } from "react-router-dom";
import "../css/Navbar.css";
import { MdBookmark } from "react-icons/md";
import { HiMenu, HiX, HiArrowLeft } from "react-icons/hi";
import { useFilter } from "../Components/FilterContext";
import LogoImg from "../assets/logo.png";

function Navbar() {
  const { showFilters, setShowFilters } = useFilter();

  function showBackBtn() {
    const backBtn = document.querySelector(".back-btn");
    if (backBtn) {
      backBtn.style.display = "block";
    }
  }

  function hideBackBtn() {
    const backBtn = document.querySelector(".back-btn");
    if (backBtn) {
      backBtn.style.display = "none";
    }
    window.history.back();
  }

  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <button
          className="menu-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? <HiX size={28} /> : <HiMenu size={28} />}
        </button>

        <Link to="/" className="navbar-brand">
          <img src={LogoImg} alt="Logo" className="navbar-logo" />
          <span className="brand-text">JobFeed</span>
        </Link>

        <div className="navbar-links">
          <button className = "back-btn" onClick={hideBackBtn}>
            <HiArrowLeft className="nav-icon" size={20} />
          </button>
          <Link to="/favorite" className="nav-link" onClick={showBackBtn}>
            <MdBookmark className="nav-icon" /> SAVED POST
          </Link>
        </div>
      </nav>
    </div>
  );
}
export default Navbar;
