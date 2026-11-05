import { useEffect, useState } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth-context.js";
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
import { AdminUsersPage } from "../pages/admin-users-page.js";
import { ElearningPage } from "../pages/elearning/elearning-page.js";
import { CourseCreatePage } from "../pages/elearning/course-create-page.js";
import { CourseEditPage } from "../pages/elearning/course-edit-page.js";
import { CourseDetailPage } from "../pages/elearning/course-detail-page.js";
import { CoursePracticePage } from "../pages/elearning/course-practice-page.js";
import { CourseExamPage } from "../pages/elearning/course-exam-page.js";
import { ExamResultsPage } from "../pages/elearning/exam-results-page.js";
import { ProfilePage } from "../pages/profile-page.js";

type ThemeMode = "light" | "dark";

function getEmailThemeKey(email: string): string {
  return `portal-theme:email:${encodeURIComponent(email.trim().toLowerCase())}`;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function getLoginTheme(): ThemeMode {
  const lastUserEmail = window.localStorage.getItem("portal-last-user-email");
  if (lastUserEmail) {
    const savedEmailTheme = window.localStorage.getItem(getEmailThemeKey(lastUserEmail));
    if (isThemeMode(savedEmailTheme)) return savedEmailTheme;
  }

  const lastUserId = window.localStorage.getItem("portal-last-user-id");
  const savedLastUserTheme = lastUserId ? window.localStorage.getItem(`portal-theme:${lastUserId}`) : null;
  return isThemeMode(savedLastUserTheme) ? savedLastUserTheme : "light";
}

function getPreferredTheme(userId: string, email: string): ThemeMode {
  const emailThemeKey = getEmailThemeKey(email);
  const savedEmailTheme = window.localStorage.getItem(emailThemeKey);
  if (isThemeMode(savedEmailTheme)) {
    window.localStorage.setItem(`portal-theme:${userId}`, savedEmailTheme);
    return savedEmailTheme;
  }

  const userThemeKey = `portal-theme:${userId}`;
  const savedUserTheme = window.localStorage.getItem(userThemeKey);
  if (isThemeMode(savedUserTheme)) {
    window.localStorage.setItem(emailThemeKey, savedUserTheme);
    return savedUserTheme;
  }

  const savedTheme = window.localStorage.getItem("portal-theme");
  if (isThemeMode(savedTheme)) {
    window.localStorage.setItem(userThemeKey, savedTheme);
    window.localStorage.setItem(emailThemeKey, savedTheme);
    window.localStorage.removeItem("portal-theme");
    return savedTheme;
  }

  return "light";
}

function PortalApp() {
  const { user, status } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(() => getLoginTheme());

  useEffect(() => {
    if (status === "authenticated" && user) {
      window.localStorage.setItem("portal-last-user-id", user.id);
      window.localStorage.setItem("portal-last-user-email", user.email.trim().toLowerCase());
      setTheme(getPreferredTheme(user.id, user.email));
    } else {
      setTheme(getLoginTheme());
    }
  }, [status, user?.id, user?.email]);

  const isAuthenticated = status === "authenticated" && user !== null;
  const activeTheme = theme;

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.style.colorScheme = activeTheme;
  }, [activeTheme]);

  function updateTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    if (isAuthenticated && user) {
      window.localStorage.setItem(`portal-theme:${user.id}`, nextTheme);
      window.localStorage.setItem(getEmailThemeKey(user.email), nextTheme);
      window.localStorage.setItem("portal-last-user-id", user.id);
      window.localStorage.setItem("portal-last-user-email", user.email.trim().toLowerCase());
    }
  }

  return (
    <FluentProvider theme={activeTheme === "dark" ? webDarkTheme : webLightTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<PortalLayout theme={activeTheme} setTheme={updateTheme} />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/areas/tasks" element={<TasksBoardPage />} />
              <Route path="/areas/tasks/archive" element={<TasksArchivePage />} />
              <Route path="/areas/applications" element={<ApplicationLinksPage />} />
              <Route path="/areas/benefits" element={<BenefitsPage />} />
              <Route path="/areas/benefits/:id" element={<BenefitDetailPage />} />
              <Route path="/areas/elearning" element={<ElearningPage />} />
              <Route path="/areas/elearning/new" element={<CourseCreatePage />} />
              <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
              <Route path="/areas/elearning/results" element={<ExamResultsPage />} />
              <Route path="/areas/elearning/:courseId" element={<CourseDetailPage />} />
              <Route path="/areas/elearning/:courseId/practice" element={<CoursePracticePage />} />
              <Route path="/areas/elearning/:courseId/exam" element={<CourseExamPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/areas/:area" element={<AreaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </FluentProvider>
  );
}

export function App() {
  return <AuthProvider><PortalApp /></AuthProvider>;
}