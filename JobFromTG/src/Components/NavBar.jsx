// Navbar.jsx
import { Link } from "react-router-dom";
import '../css/Navbar.css';

function Navbar() {
  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🏢</span>
          JobSearch
        </Link>

        <div className="navbar-links">
          <Link to="/favorite" className="nav-link"><i class="fa-solid fa-bookmark"></i> Saved post</Link>
         
        </div>

    
      </nav>
    </div>
  );
}
export default Navbar;