import { ChevronRight20Regular } from "@fluentui/react-icons";

type ChapterResult = {
  chapter: number;
  title: string | undefined;
  correct: number;
  wrong: number;
  open: number;
  total: number;
};

function chapterRecommendation(wrong: number, open: number) {
  return wrong > 0
    ? "Lernziele dieses Kapitels wiederholen und Fehler gezielt üben."
    : open > 0 ? "Offene Fragen dieses Kapitels bearbeiten und Antworten prüfen."
      : "Alle Fragen richtig beantwortet. Wissen durch regelmäßige Wiederholung festigen.";
}

export function ChapterResults({ chapters }: { chapters: ChapterResult[] }) {
  return (
    <>
      <div className="practice-results-table-wrapper practice-chapters-desktop" role="region" aria-label="Ergebnis pro Kapitel" tabIndex={0}>
        <table className="practice-results-table">
          <caption>Ergebnis pro Kapitel</caption>
          <thead><tr>
            <th scope="col">Kapitel</th><th scope="col">Richtig</th><th scope="col">Falsch</th>
            <th scope="col">Offen</th><th scope="col">Gesamt</th><th scope="col">Punkte</th>
            <th scope="col">Empfehlung</th>
          </tr></thead>
          <tbody>{chapters.map(({ chapter, title, correct, wrong, open, total }) => (
            <tr key={chapter}>
              <th scope="row">{chapter}. {title}</th>
              <td>{correct}</td><td>{wrong}</td><td>{open}</td><td>{total}</td>
              <td>{correct}/{total} Pkt.</td>
              <td>{chapterRecommendation(wrong, open)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="practice-chapters">
        {chapters.map(({ chapter, title, correct, wrong, open, total }) => {
          const label = `${chapter}. ${title ?? ""}`.trim();
          return (
            <details className="practice-chapter" key={chapter}>
              <summary className="practice-chapter__summary">
                <span>{label}</span>
                <span className="practice-chapter__points">{correct}/{total} Pkt.</span>
                <ChevronRight20Regular className="practice-chapter__chevron" aria-hidden="true" />
              </summary>
              <table className="practice-chapter__table" aria-label={`Ergebnis Kapitel ${chapter}: ${title ?? ""}`}>
                <colgroup><col /><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th scope="col">Kapitel</th><th scope="col">Richtig</th>
                    <th scope="col">Falsch</th><th scope="col">Offen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">
                      {label}
                      <span className="practice-chapter__meta">
                        {correct}/{total} Pkt. · {Math.round((correct / total) * 100)} %
                      </span>
                    </th>
                    <td><span className={`practice-chapter__count${correct > 0 ? " practice-chapter__count--correct" : ""}`}>{correct}</span></td>
                    <td><span className={`practice-chapter__count${wrong > 0 ? " practice-chapter__count--wrong" : ""}`}>{wrong}</span></td>
                    <td><span className="practice-chapter__count">{open}</span></td>
                  </tr>
                  <tr className="practice-chapter__recommendation">
                    <td colSpan={4}>
                      <div className="practice-chapter__advice">
                        <strong>{wrong > 0 ? "Lernempfehlung" : open > 0 ? "Noch offen" : "Alles richtig"} · Kapitel {chapter}</strong>
                        <p>{chapterRecommendation(wrong, open)}</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    </>
  );
}
