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
          <Link to="/" className="nav-link active">Home</Link>
          <Link to="/favorite" className="nav-link">Favorite</Link>
          <Link to="/apply" className="nav-link">Apply</Link>
        </div>

    
      </nav>
    </div>
  );
}
export default Navbar;