import { Button } from "@fluentui/react-components";
import { ArrowExit20Regular, Home24Regular, WeatherMoon20Filled, WeatherSunny20Regular } from "@fluentui/react-icons";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { portalAreas } from "@portal/shared";
import { useAuth } from "./auth-context.js";
import { AreaIcon } from "./area-icon.js";

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

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="portal-root">
      <header className="portal-header">
        <a className="brand" href="/" aria-label="TestConsulting Übersicht">
          <span className="brand-mark" aria-hidden="true">TC</span>
          <span>TestConsulting</span>
        </a>
        <div className="header-account">
          <span className="avatar" aria-label={`Angemeldet als ${user?.name}`}>
            {user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span className="header-account__name">{user?.name}</span>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <Button appearance="subtle" icon={<ArrowExit20Regular />} onClick={handleSignOut} aria-label="Abmelden" title="Abmelden" />
        </div>
      </header>
      <div className="portal-shell">
        <aside className="portal-sidebar" aria-label="Portalnavigation">
          <span className="sidebar-label">Arbeitsbereich</span>
          <nav className="portal-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`}>
              <Home24Regular aria-hidden="true" /> Übersicht
            </NavLink>
            {portalAreas.map((area) => (
              <NavLink key={area.slug} to={`/areas/${area.slug}`} className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`}>
                <AreaIcon slug={area.slug} /> {area.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-account">
            <span className="sidebar-label">Konto</span>
            <Button appearance="subtle" icon={<ArrowExit20Regular />} onClick={handleSignOut} className="signout-button">
              Abmelden
            </Button>
          </div>
        </aside>
        <main className="portal-main"><Outlet /></main>
      </div>
    </div>
  );
}