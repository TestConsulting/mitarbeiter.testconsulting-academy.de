import { MessageBar, MessageBarBody, Spinner } from "@fluentui/react-components";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context.js";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return <div className="route-loading"><Spinner label="Anmeldestatus wird geprüft" /></div>;
  }
  if (status === "unavailable") {
    return (
      <main className="route-loading">
        <MessageBar intent="error"><MessageBarBody>Das Portal ist gerade nicht erreichbar. Bitte lade die Seite erneut.</MessageBarBody></MessageBar>
      </main>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}