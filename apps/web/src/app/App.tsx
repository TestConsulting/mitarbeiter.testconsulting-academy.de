import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth-context.js";
import { PortalLayout } from "./portal-layout.js";
import { ProtectedRoute } from "./protected-route.js";
import { AreaPage } from "../pages/area-page.js";
import { LoginPage } from "../pages/login-page.js";
import { OverviewPage } from "../pages/overview-page.js";
import { TasksBoardPage } from "../pages/tasks-board-page.js";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<PortalLayout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/areas/tasks" element={<TasksBoardPage />} />
              <Route path="/areas/:area" element={<AreaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}