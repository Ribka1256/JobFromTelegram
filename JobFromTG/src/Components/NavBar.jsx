import { useState, useEffect }  from "react";
import { Link }                  from "react-router-dom";
import "../css/Navbar.css";
import { MdBookmark }            from "react-icons/md";
import { FaArrowLeft }           from "react-icons/fa6";
import LogoImg                   from "../assets/logo.png";
import { getSyncTime }           from "../service/api.js";

// ─── Relative-time helper ──────────────────────────────────────────────────
/**
 * Returns two labels for a given ISO timestamp:
 *   long  → "Synced 5 minutes ago"   (shown on desktop)
 *   short → "5m"                      (shown on mobile)
 *
 * Returns null when isoString is falsy or invalid.
 */
function calcSyncLabel(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff) || diff < 0) return { long: "Synced just now", short: "now" };

  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins <  1) return { long: "Synced just now",                                  short: "now" };
  if (mins < 60) return { long: `Synced ${mins} minute${mins !== 1 ? "s" : ""} ago`, short: `${mins}m` };
  if (hrs  < 24) return { long: `Synced ${hrs} hour${hrs   !== 1 ? "s" : ""} ago`,   short: `${hrs}h`  };
  return           { long: `Synced ${days} day${days   !== 1 ? "s" : ""} ago`,         short: `${days}d` };
}

// ─── Component ────────────────────────────────────────────────────────────────
function Navbar() {
  const returnBack = () => {
    window.history.back();
    document.querySelector(".back-button").style.display = "none";
  };
  const savedBtn = () => {
    document.querySelector(".back-button").style.display = "flex";
  };

  // ── Sync-status state ──────────────────────────────────────────────────
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncNever,    setSyncNever]    = useState(false);
  const [syncLabel,    setSyncLabel]    = useState(null);

  // Fetch the real sync timestamp from the backend.
  // Re-fetch every 5 minutes so a new scheduler run is eventually reflected.
  useEffect(() => {
    let cancelled = false;

    const fetchSync = async () => {
      try {
        const d = await getSyncTime();
        if (cancelled) return;
        if (d?.lastSyncedAt) {
          setLastSyncedAt(d.lastSyncedAt);
          setSyncNever(false);
        } else if (d?.status === "never") {
          setSyncNever(true);
        }
        // If d is null (network error) we leave previous state untouched
      } catch {
        /* silent — never break the navbar */
      }
    };

    fetchSync();
    const pollId = setInterval(fetchSync, 5 * 60 * 1000); // every 5 min
    return () => { cancelled = true; clearInterval(pollId); };
  }, []);

  // Recalculate the displayed relative time every 60 seconds locally.
  // No extra API call needed — just Math on the stored timestamp.
  useEffect(() => {
    const update = () => setSyncLabel(calcSyncLabel(lastSyncedAt));
    update();
    const tickId = setInterval(update, 60_000);
    return () => clearInterval(tickId);
  }, [lastSyncedAt]);

  // ── Render ─────────────────────────────────────────────────────────────
  const showPill = syncLabel !== null || syncNever;

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

          {/* ── Sync status pill ──────────────────────────────────────── */}
          {showPill && (
            <div
              className={`sync-pill${syncNever ? " sync-pill--never" : ""}`}
              title={
                syncNever
                  ? "No sync has completed yet"
                  : `Last synced: ${new Date(lastSyncedAt).toLocaleString()}`
              }
            >
              <span className="sync-dot" />
              {/* Desktop: full text */}
              <span className="sync-label-long">
                {syncNever ? "Not synced yet" : syncLabel?.long}
              </span>
              {/* Mobile: compact text — hidden when never synced */}
              {!syncNever && syncLabel && (
                <span className="sync-label-short">{syncLabel.short}</span>
              )}
            </div>
          )}

          <Link to="/favorite" className="nav-link" onClick={savedBtn}>
            <MdBookmark className="nav-icon" /><span className="nav-link-text"> SAVED JOBS</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
