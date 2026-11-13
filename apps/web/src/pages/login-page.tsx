import { useState, type FormEvent } from "react";
import { Button, Field, Input, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { WeatherMoon20Filled, WeatherSunny20Regular } from "@fluentui/react-icons";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";

type LoginPageProps = {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

export function LoginPage({ theme, setTheme }: LoginPageProps) {
  const { signIn, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      const target = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
      navigate(target, { replace: true });
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 401
        ? "E-Mail oder Passwort ist nicht korrekt."
        : "Die Anmeldung ist gerade nicht möglich. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  const isDark = theme === "dark";

  return (
    <main className="signin-layout">
      <div className="theme-switcher theme-switcher--login">
        <Button
          appearance="secondary"
          size="small"
          icon={isDark ? <WeatherSunny20Regular /> : <WeatherMoon20Filled />}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Light mode" : "Dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? "Hell" : "Dunkel"}
        </Button>
      </div>
      <section className="signin-brand-panel" aria-labelledby="brand-title">
        <div className="brand-logo-shell brand-logo-shell--login">
          <img className="brand-logo brand-logo--login" src="/images/testconsulting-logo-dark.png" alt="TestConsulting Logo" />
        </div>
        <div className="signin-rule" aria-hidden="true" />
        <h1 id="brand-title">Mitarbeiterportal</h1>
        <p>Lernangebote, Unternehmenswerkzeuge und Zusammenarbeit an einem Ort.</p>
      </section>
      <section className="signin-form-column">
        <div className="signin-form-wrap">
          <div>
            <span className="eyebrow">Interner Zugang</span>
            <h2>Anmelden</h2>
            <p>Mit deinem Mitarbeiterkonto fortfahren.</p>
          </div>
          {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
          <form className="signin-form" onSubmit={handleSubmit}>
            <Field label="E-Mail" required>
              <Input
                type="email"
                name="email"
                autoComplete="username"
                placeholder="name@unternehmen.de"
                value={email}
                onChange={(_event, data) => setEmail(data.value)}
                required
              />
            </Field>
            <Field label="Passwort" required>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Passwort eingeben"
                value={password}
                onChange={(_event, data) => setPassword(data.value)}
                required
              />
            </Field>
            <Button appearance="primary" type="submit" disabled={submitting}>
              {submitting ? "Anmeldung läuft …" : "Anmelden"}
            </Button>
          </form>
          <p className="signin-note">Geschützter Bereich für Mitarbeitende</p>
        </div>
      </section>
    </main>
  );
}