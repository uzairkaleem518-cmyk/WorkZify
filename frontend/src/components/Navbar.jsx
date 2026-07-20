import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import api from "../api/api.js";
import BrandLogo from "./BrandLogo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const navLinkClass = ({ isActive }) =>
  `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
    isActive
      ? "bg-teal-500 text-white"
      : "text-ink/80 hover:bg-surface2"
  }`;

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState(() => localStorage.getItem("customerName"));
  const [expiredMsg, setExpiredMsg] = useState(null);

  // Re-check login state whenever the route changes - this covers the
  // customer just having logged in/out and been navigated elsewhere,
  // without needing every auth page to separately notify the Navbar.
  useEffect(() => {
    setCustomerName(localStorage.getItem("customerName"));
  }, [location.pathname]);

  // Consistent, app-wide "your session expired" message - fired once from
  // the axios interceptor in api.js whenever any request comes back 401,
  // instead of each page inventing its own wording (or none at all).
  useEffect(() => {
    const handleExpired = () => {
      setCustomerName(null);
      setExpiredMsg("Your session has expired. Please log in again.");
      const timer = setTimeout(() => setExpiredMsg(null), 5000);
      return () => clearTimeout(timer);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  const logoutCustomer = async () => {
    try {
      await api.post("/auth/logout", {}, { authRole: "customer" });
    } finally {
      localStorage.removeItem("customerToken");
      localStorage.removeItem("customerName");
      setCustomerName(null);
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur border-b border-border">
      {expiredMsg && (
        <div className="bg-marigold-500/15 text-marigold-700 dark:text-marigold-300 text-xs sm:text-sm text-center py-1.5 px-4">
          {expiredMsg}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="shrink-0" aria-label="WorkZify home">
          <BrandLogo />
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <NavLink to="/" className={navLinkClass} end>Search</NavLink>
          <NavLink to="/worker/register" className={navLinkClass}>Join</NavLink>
          <NavLink to="/worker/login" className={navLinkClass}>Worker</NavLink>

          {customerName ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-2 py-1.5 text-sm text-ink/80 max-w-[110px] truncate" title={customerName}>
                Hi, {customerName}
              </span>
              <button
                onClick={logoutCustomer}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-ink/80 hover:bg-surface2"
              >
                Logout
              </button>
            </div>
          ) : (
            <NavLink to="/customer/login" className={navLinkClass}>Customer</NavLink>
          )}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
