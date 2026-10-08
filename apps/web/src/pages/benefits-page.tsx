import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { ArrowRight20Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Benefit } from "@portal/shared";
import { canManagePortal } from "@portal/shared";
import { ApiError, api } from "../api/client.js";
import { AreaIcon } from "../app/area-icon.js";
import { useAuth } from "../app/auth-context.js";
import { BenefitActions } from "./benefit-actions.js";
import { SortablePortalCard } from "./sortable-portal-card.js";
import { BenefitLink } from "./benefit-link.js";
import { BenefitIcon } from "./benefit-icon.js";

export function BenefitsPage() {
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const location = useLocation();
  const navigationState: unknown = location.state;
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [reorderError, setReorderError] = useState("");
  const [busy, setBusy] = useState(false);
  const [interactionActive, setInteractionActive] = useState(false);
  const reorderPending = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [notice, setNotice] = useState(
    navigationState !== null && typeof navigationState === "object" && "benefitDeleted" in navigationState &&
    navigationState.benefitDeleted === true ? "Benefit wurde gelöscht." : "",
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.benefits.list().then((data) => {
      if (!active) return;
      setBenefits(data);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [loadAttempt]);

  function saved(benefit: Benefit) {
    setBenefits((current) => [...current.filter((entry) => entry.id !== benefit.id), benefit]);
    setNotice("Benefit wurde gespeichert.");
  }

  function deleted(id: string) {
    setBenefits((current) => current.filter((entry) => entry.id !== id));
    setNotice("Benefit wurde gelöscht.");
  }

  const sorted = useMemo(
    () => [...benefits].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
    [benefits],
  );

  async function reorderBenefits({ active, over }: DragEndEvent) {
    if (!isAdmin || busy || interactionActive || reorderPending.current || !over || active.id === over.id) return;
    const from = sorted.findIndex((benefit) => benefit.id === active.id);
    const to = sorted.findIndex((benefit) => benefit.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(sorted, from, to).map((benefit, sortOrder) => ({ ...benefit, sortOrder }));
    reorderPending.current = true;
    setBusy(true);
    setReorderError("");
    setNotice("");
    setBenefits(reordered);
    try {
      setBenefits(await api.benefits.reorder(reordered.map((benefit) => benefit.id)));
      setNotice("Reihenfolge wurde für alle Mitarbeitenden gespeichert.");
    } catch (error) {
      setBenefits(sorted);
      setReorderError(error instanceof ApiError ? error.message : "Die Reihenfolge konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      reorderPending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="page-stack benefits-page">
      <div className="page-heading">
        <h1><AreaIcon slug="benefits" /> Benefits</h1>
        {status === "ready" && <BenefitActions onSaved={saved} disabled={busy} onInteractionChange={setInteractionActive} />}
      </div>
      <p className="benefits-intro">Deine Vorteile auf einen Blick. Entdecke alle Informationen auf der jeweiligen Detailseite.</p>
      {reorderError && <MessageBar intent="error"><MessageBarBody>{reorderError}</MessageBarBody></MessageBar>}
      {notice && <p role="status">{notice}</p>}
      {status === "loading" && <p role="status">Benefits werden geladen …</p>}
      {status === "error" && (
        <section className="empty-state" role="alert">
          <h2>Benefits konnten nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      )}
      {status === "ready" && sorted.length === 0 && (
        <section className="empty-state">
          <span className="empty-state__icon"><AreaIcon slug="benefits" large /></span>
          <h2>Noch keine Benefits vorhanden.</h2>
          <p>{isAdmin ? "Füge den ersten Benefit für deine Mitarbeitenden hinzu." : "Die Benefits werden von der Administration bereitgestellt."}</p>
        </section>
      )}
      {status === "ready" && sorted.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderBenefits}>
        <SortableContext items={sorted.map((benefit) => benefit.id)} strategy={rectSortingStrategy}>
        <div className="benefits-grid" aria-busy={busy}>
          {sorted.map((benefit) => (
            <SortablePortalCard id={benefit.id} label={benefit.title} className="benefit-card" key={benefit.id}
              isAdmin={isAdmin} disabled={!isAdmin || busy || interactionActive}>
              <div className="benefit-card__content">
                <BenefitIcon title={benefit.title} />
                <h2>{benefit.title}</h2>
                <p>{benefit.description}</p>
                <Link className="benefit-card__open" to={`/areas/benefits/${benefit.id}`} draggable={false} aria-label={`${benefit.title}: Details ansehen`}>
                  Details ansehen <ArrowRight20Regular aria-hidden="true" />
                </Link>
                <BenefitLink benefit={benefit} />
              </div>
              {isAdmin && (
                <div className="benefit-card__actions">
                  <BenefitActions benefit={benefit} onSaved={saved} onDeleted={deleted}
                    disabled={busy} onInteractionChange={setInteractionActive} />
                </div>
              )}
            </SortablePortalCard>
          ))}
        </div>
        </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
