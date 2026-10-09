import { useEffect, useState } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth-context.js";
import { PortalLayout } from "./portal-layout.js";
import { ProtectedRoute } from "./protected-route.js";
import { AreaPage } from "../pages/area-page.js";
import { LoginPage } from "../pages/login-page.js";
import { OverviewPage } from "../pages/overview-page.js";
import { TasksArchivePage } from "../pages/tasks-archive-page.js";
import { TasksBoardPage } from "../pages/tasks-board-page.js";
import { ApplicationLinksPage } from "../pages/application-links-page.js";
import { BenefitsPage } from "../pages/benefits-page.js";
import { BenefitDetailPage } from "../pages/benefit-detail-page.js";

type ThemeMode = "light" | "dark";

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem("portal-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  const mediaQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  return mediaQuery?.matches ? "dark" : "light";
}

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(getPreferredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("portal-theme", theme);
  }, [theme]);

  return (
    <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage theme={theme} setTheme={setTheme} />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<PortalLayout theme={theme} setTheme={setTheme} />}>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/areas/tasks" element={<TasksBoardPage />} />
                <Route path="/areas/tasks/archive" element={<TasksArchivePage />} />
                <Route path="/areas/applications" element={<ApplicationLinksPage />} />
                <Route path="/areas/benefits" element={<BenefitsPage />} />
                <Route path="/areas/benefits/:id" element={<BenefitDetailPage />} />
                <Route path="/areas/:area" element={<AreaPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </FluentProvider>
  );
}