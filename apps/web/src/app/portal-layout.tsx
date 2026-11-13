import { useEffect, useRef, useState } from "react";
import { Button } from "@fluentui/react-components";
import {
  ArrowExit20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  ContactCard16Regular,
  Home24Regular,
  Navigation20Regular,
  PeopleTeam24Regular,
  Person20Regular,
  Shield16Regular,
  WeatherMoon20Filled,
  WeatherSunny20Regular,
} from "@fluentui/react-icons";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { canManagePortal, portalAreas } from "@portal/shared";
import { useAuth } from "./auth-context.js";
import { AreaIcon } from "./area-icon.js";
import { MobileNavDrawer } from "./mobile-nav-drawer.js";

type ThemeToggleProps = {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

function ThemeToggle({ theme, setTheme }: ThemeToggleProps) {
  const isDark = theme === "dark";

  return (
    <Button
      appearance="subtle"
      size="small"
      className="theme-toggle"
      icon={isDark ? <WeatherSunny20Regular /> : <WeatherMoon20Filled />}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Light mode" : "Dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? "Hell" : "Dunkel"}
    </Button>
  );
}

export function PortalLayout({ theme, setTheme }: ThemeToggleProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileActive = location.pathname.startsWith("/profile") || location.pathname.startsWith("/admin/users");
  const [accountExpanded, setAccountExpanded] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  const isExpanded = accountExpanded && isProfileActive;

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  const navigationContent = (
    <>
      <span className="sidebar-label">Arbeitsbereich</span>
      <nav className="portal-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`} onClick={closeMobileNav}>
          <Home24Regular aria-hidden="true" /> Übersicht
        </NavLink>
        {portalAreas.map((area) => (
          <NavLink key={area.slug} to={`/areas/${area.slug}`} className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`} onClick={closeMobileNav}>
            <AreaIcon slug={area.slug} /> {area.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-account">
        <span className="sidebar-label">Konto</span>
        <div className="account-nav-group">
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item nav-item--parent${isActive ? " nav-item--active" : ""}`}
            onClick={() => {
              closeMobileNav();
              if (isProfileActive) {
                setAccountExpanded((prev) => !prev);
              } else {
                setAccountExpanded(true);
              }
            }}
          >
            <span className="nav-item__content">
              <Person20Regular aria-hidden="true" /> Mein Profil
            </span>
            <span className="nav-item__chevron" aria-hidden="true">
              {isExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
            </span>
          </NavLink>
          {isExpanded && (
            <div className="nav-subgroup" role="group" aria-label="Profil-Bereiche">
              <Link
                to="/profile?section=personal"
                className={`nav-subitem${location.search.includes("section=personal") ? " nav-subitem--active" : ""}`}
                onClick={closeMobileNav}
              >
                <ContactCard16Regular aria-hidden="true" /> Persönliche Daten
              </Link>
              <Link
                to="/profile?section=security"
                className={`nav-subitem${location.search.includes("section=security") ? " nav-subitem--active" : ""}`}
                onClick={closeMobileNav}
              >
                <Shield16Regular aria-hidden="true" /> Sicherheit
              </Link>
              {canManagePortal(user) && (
                <NavLink to="/admin/users" className={({ isActive }) => `nav-subitem${isActive ? " nav-subitem--active" : ""}`} onClick={closeMobileNav}>
                  <PeopleTeam24Regular aria-hidden="true" /> Benutzerverwaltung
                </NavLink>
              )}
            </div>
          )}
        </div>
        <Button appearance="subtle" icon={<ArrowExit20Regular />} onClick={handleSignOut} className="signout-button">
          Abmelden
        </Button>
      </div>
    </>
  );

  return (
    <div className="portal-root">
      <header className="portal-header">
        <div className="portal-header__left">
          <Button
            ref={navToggleRef}
            appearance="subtle"
            className="nav-toggle"
            icon={<Navigation20Regular />}
            aria-label="Navigation öffnen"
            title="Navigation öffnen"
            aria-controls="portal-navigation"
            aria-expanded={mobileNavOpen}
            aria-haspopup="dialog"
            onClick={() => setMobileNavOpen((open) => !open)}
          />
          <a className="brand" href="/" aria-label="TestConsulting Übersicht" onClick={closeMobileNav}>
            <img className="brand-logo brand-logo--header" src="/images/testconsulting-logo.png" alt="TestConsulting Logo" />
          </a>
        </div>
        <div className="header-account">
          <NavLink to="/profile" className="header-account__profile" aria-label={`Mein Profil: ${user?.email ?? ""}`}>
            <span className="avatar" aria-hidden="true">
              {user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="header-account__name">{user?.email}</span>
          </NavLink>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <Button appearance="subtle" icon={<ArrowExit20Regular />} onClick={handleSignOut} aria-label="Abmelden" title="Abmelden" />
        </div>
      </header>
      <div className="portal-shell">
        <aside className="portal-sidebar" aria-label="Portalnavigation">
          {navigationContent}
        </aside>
        <MobileNavDrawer isOpen={mobileNavOpen} onClose={closeMobileNav} triggerRef={navToggleRef}>
          {navigationContent}
        </MobileNavDrawer>
        <main className="portal-main"><Outlet /></main>
      </div>
    </div>
  );
}