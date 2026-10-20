export type CourseCategory = "Vorstellung" | "ISTQB" | "Sonstiges";

export type LearningMaterial = {
  id: string;
  title: string;
  fileName: string;
  fileSize?: string;
  url: string;
};

export type QuestionOption = {
  id: string;
  text: string;
};

export type PracticeQuestion = {
  id: string;
  question: string;
  type: "single" | "multiple";
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
  metadata?: {
    chapter: number;
    chapterTitle: string;
    learningObjective: string;
    kLevel: "K1" | "K2" | "K3";
  };
};

export type PracticeProgress = {
  questionId: string;
  lastCorrect: boolean;
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  category: CourseCategory;
  description: string;
  isDemo?: boolean;
  demoNotice?: string;
  materials: LearningMaterial[];
  questions: PracticeQuestion[];
};

export type CourseSummary = Omit<Course, "questions"> & {
  questionCount: number;
};

export type ExamQuestion = Omit<PracticeQuestion, "correctOptionIds" | "explanation"> & {
  requiredSelections?: number;
};

export type ExamCourse = Pick<
  Course,
  "id" | "slug" | "title" | "category" | "description" | "isDemo" | "demoNotice"
> & {
  questions: ExamQuestion[];
};

export type ExamAnswer = {
  questionId: string;
  selectedOptionIds: string[];
};

export type ExamQuestionResult = {
  question: ExamQuestion;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  explanation: string;
  isCorrect: boolean;
};

export type ExamSubmissionResult = {
  percentage: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  results: ExamQuestionResult[];
};

export type ExamAttempt = ExamSubmissionResult & {
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  submittedAt: string;
};

export const EXAM_PASS_THRESHOLD = 65;

export const CTFL_EXAM_CHAPTER_COUNTS = [8, 6, 4, 11, 9, 2] as const;
export const CTFL_EXAM_K_LEVEL_COUNTS = { K1: 8, K2: 24, K3: 8 } as const;
export const CTFL_EXAM_DURATION_MINUTES = 60;
export const CTFL_EXAM_EXTENDED_MINUTES = 75;
export const CTFL_EXAM_QUESTION_COUNT = 40;

export type ExamSession = {
  id: string;
  course: ExamCourse;
  status: "active" | "submitted" | "expired" | "aborted";
  startedAt: string;
  expiresAt: string;
  finishedAt: string | null;
  serverTime: string;
  durationMinutes: number;
  answers: ExamAnswer[];
  result: ExamSubmissionResult | null;
};

export type AbortedExamSession = {
  id: string;
  courseTitle: string;
  startedAt: string;
  finishedAt: string;
};

export type CourseInput = Omit<Course, "id" | "slug">;

export const courseCategories: readonly ("Alle" | CourseCategory)[] = [
  "Alle",
  "Vorstellung",
  "ISTQB",
  "Sonstiges",
] as const;

export const coursesData: Course[] = [
  {
    id: "fragenkatalog-essentials",
    slug: "fragenkatalog-essentials",
    title: "Fragenkatalog Essentials",
    category: "Vorstellung",
    description:
      "Wesentliche Grundlagen, Unternehmenswerte und Kernfragen zur Vorbereitung auf Vorstellungsgespräche und Projekt-Onboarding bei TestConsulting.",
    isDemo: true,
    demoNotice:
      "Hinweis: Dies sind didaktische Beispiel- und Übungsfragen zu Übungszwecken für das Onboarding und Bewerbungsgespräche.",
    materials: [
      {
        id: "mat-essentials-1",
        title: "TestConsulting Essentials Leitfaden",
        fileName: "TC-Fragenkatalog-Essentials-Leitfaden.pdf",
        fileSize: "240 KB",
        url: "/documents/TC-Fragenkatalog-Essentials-Leitfaden.pdf",
      },
    ],
    questions: [
      {
        id: "ess-q1",
        question: "Was zeichnet den Beratungsansatz von TestConsulting bei der Qualitätssicherung primär aus?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Partnerschaftliche Begleitung, praxisnahe Testmethodik und nachhaltige Verankerung von Qualitätsstandards.",
          },
          {
            id: "opt-2",
            text: "Ausschließliche Fokussierung auf manuelle Testausführung kurz vor dem Produktionsrelease.",
          },
          {
            id: "opt-3",
            text: "Vollständige Auslagerung von Testaufgaben ohne internen Wissenstransfer an das Kundenteam.",
          },
          {
            id: "opt-4",
            text: "Verzicht auf Prozessdokumentation zugunsten kurzfristiger Geschwindigkeitsvorteile.",
          },
        ],
        correctOptionIds: ["opt-1"],
        explanation:
          "TestConsulting versteht Qualitätssicherung als partnerschaftliche Beratung, die methodische Exzellenz mit pragmatischer Umsetzung und gezieltem Wissenstransfer verbindet.",
      },
      {
        id: "ess-q2",
        question:
          "Welche Faktoren sind für einen überzeugenden Auftritt im Kundengespräch besonders wichtig? (Wähle alle zutreffenden Antworten)",
        type: "multiple",
        options: [
          {
            id: "opt-1",
            text: "Gezielte Vorbereitung auf den Projektkontext und die eingesetzten Technologien.",
          },
          {
            id: "opt-2",
            text: "Aktives Zuhören und Nachfragen zu den spezifischen Qualitätszielen des Kunden.",
          },
          {
            id: "opt-3",
            text: "Pauschales Versprechen aller Anforderungen ohne vorherige Prüfung der Machbarkeit.",
          },
          {
            id: "opt-4",
            text: "Transparente und authentische Darstellung der eigenen Praxiserfahrungen und Stärken.",
          },
        ],
        correctOptionIds: ["opt-1", "opt-2", "opt-4"],
        explanation:
          "Ein professioneller Beraterauftritt beruht auf fundierter Vorbereitung, echtem Interesse an den Kundenherausforderungen und authentischer Kommunikation. Ungeprüfte Zusagen schwächen das Vertrauen.",
      },
      {
        id: "ess-q3",
        question: "Wie sollte ein Test-Consultant mit unklaren oder widersprüchlichen Anforderungen umgehen?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Eigene Annahmen ohne Abstimmung treffen und Tests ausschließlich darauf aufbauen.",
          },
          {
            id: "opt-2",
            text: "Unklarheiten frühzeitig ansprechen, Annahmen dokumentieren und Abnahmekriterien gemeinsam schärfen.",
          },
          {
            id: "opt-3",
            text: "Die Anforderung ignorieren und erst nach Fertigstellung des Gesamtsystems testen.",
          },
          {
            id: "opt-4",
            text: "Die Klärung bis zum nächsten Hauptrelease aufschieben.",
          },
        ],
        correctOptionIds: ["opt-2"],
        explanation:
          "Frühzeitiges Klären von Anforderungen ('Shift Left') verhindert Missverständnisse und spart teure Fehlerbehebungen in späteren Entwicklungsphasen.",
      },
      {
        id: "ess-q4",
        question: "Welchen Hauptnutzen stiftet Testautomatisierung in agilen Softwareprojekten?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Schnelles, reproduzierbares Feedback für Regressionstests bei kontinuierlichen Änderungen.",
          },
          {
            id: "opt-2",
            text: "Die vollständige Abschaffung manueller und explorativer Tests.",
          },
          {
            id: "opt-3",
            text: "Automatisches Verfassen von Fachkonzepten und User Stories.",
          },
          {
            id: "opt-4",
            text: "Garantie für 100 % fehlerfreie Software ohne weitere Qualitätssicherungsmaßnahmen.",
          },
        ],
        correctOptionIds: ["opt-1"],
        explanation:
          "Testautomatisierung liefert schnelles Feedback zu Regressionen und entlastet das Team, sodass wertvolle Zeit für explorative Tests und komplexe Szenarien frei wird.",
      },
    ],
  },
  {
    id: "istqb-foundation",
    slug: "istqb-foundation",
    title: "ISTQB Foundation",
    category: "ISTQB",
    description:
      "Grundlagen des Softwaretestens nach ISTQB Certified Tester Foundation Level (CTFL). Testprinzipien, Testphasen, statischer und dynamischer Test.",
    isDemo: true,
    demoNotice:
      "Hinweis: Dies sind didaktische Beispiel- und Übungsfragen zur Orientierung und keine offiziellen Prüfungsfragen des ISTQB-Boards.",
    materials: [],
    questions: [
      {
        id: "istqb-q1",
        question: "Welches der folgenden Grundprinzipien des Testens ist ein offizielles ISTQB-Testprinzip?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Testen zeigt das Vorhandensein von Fehlern, nicht deren Abwesenheit.",
          },
          {
            id: "opt-2",
            text: "Vollständiges Testen aller Eingaben ist für jedes Projekt anzustreben.",
          },
          {
            id: "opt-3",
            text: "Tests sollten grundsätzlich erst nach Fertigstellung des Gesamtsystems starten.",
          },
          {
            id: "opt-4",
            text: "Fehler verteilen sich immer gleichmäßig über alle Module einer Anwendung.",
          },
        ],
        correctOptionIds: ["opt-1"],
        explanation:
          "Prinzip 1 des ISTQB besagt: Testen kann zeigen, dass Fehler vorliegen, aber es kann niemals beweisen, dass die Software vollkommen fehlerfrei ist.",
      },
      {
        id: "istqb-q2",
        question: "Wie unterscheiden sich Fehlhandlung (Error), Fehlerzustand (Defect) und Fehlwirkung (Failure)?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Eine Fehlhandlung eines Menschen führt zu einem Fehlerzustand im Code, der bei Ausführung eine Fehlwirkung verursachen kann.",
          },
          {
            id: "opt-2",
            text: "Die Begriffe sind im ISTQB-Glossar vollkommen synonym und austauschbar.",
          },
          {
            id: "opt-3",
            text: "Fehlwirkungen entstehen nur durch fehlerhafte Hardware, Fehlerzustände nur im Anforderungsdokument.",
          },
          {
            id: "opt-4",
            text: "Ein Fehlerzustand tritt nur dann auf, wenn der Tester eine Fehlhandlung begangen hat.",
          },
        ],
        correctOptionIds: ["opt-1"],
        explanation:
          "Ein Mensch begeht einen Irrtum (Fehlhandlung/Error), der zu einem Fehlerzustand (Defect/Bug) im Dokument oder Code führt. Wird dieser Code ausgeführt, kann das System ein unerwartetes Verhalten zeigen (Fehlwirkung/Failure).",
      },
      {
        id: "istqb-q3",
        question:
          "Welche der folgenden Aktivitäten gehören zum fundamentalen Testprozess nach ISTQB? (Wähle alle zutreffenden Antworten)",
        type: "multiple",
        options: [
          {
            id: "opt-1",
            text: "Testplanung und Teststeuerung",
          },
          {
            id: "opt-2",
            text: "Testanalyse und Testentwurf",
          },
          {
            id: "opt-3",
            text: "Testdurchführung und Protokollierung",
          },
          {
            id: "opt-4",
            text: "Debugging und direkte Korrektur des fehlerhaften Quellcodes",
          },
        ],
        correctOptionIds: ["opt-1", "opt-2", "opt-3"],
        explanation:
          "Planung, Analyse, Entwurf, Implementierung, Durchführung und Testabschluss sind Kernphasen des Testprozesses. Das Auffinden der Ursache und Beheben im Quellcode (Debugging) ist eine Entwicklungsaktivität.",
      },
      {
        id: "istqb-q4",
        question: "Was ist das Hauptziel von Regressionstests?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Das Entdecken von Fehlern in neu entwickelten Funktionen.",
          },
          {
            id: "opt-2",
            text: "Sicherstellen, dass Code-Änderungen keine ungewollten Fehler in unveränderten Systemteilen verursacht haben.",
          },
          {
            id: "opt-3",
            text: "Die Messung der maximalen Benutzerlast unter Extrembedingungen.",
          },
          {
            id: "opt-4",
            text: "Die Überprüfung der Benutzerfreundlichkeit durch Endanwender.",
          },
        ],
        correctOptionIds: ["opt-2"],
        explanation:
          "Regressionstests stellen sicher, dass durch Fehlerbehebungen oder neue Features bereits funktionierende Programmteile nicht beschädigt wurden.",
      },
    ],
  },
  {
    id: "projektausschreibung-ta-robot",
    slug: "projektausschreibung-ta-robot",
    title: "Projektausschreibung TA-Robot: Fragen",
    category: "Sonstiges",
    description:
      "Vorbereitung auf typische Fragen und Anforderungen in Ausschreibungen zur Testautomatisierung mit dem Robot Framework.",
    isDemo: true,
    demoNotice:
      "Hinweis: Dieser Kurs befindet sich in redaktioneller Vorbereitung. Die Übungsfragen dienen der Veranschaulichung.",
    materials: [],
    questions: [
      {
        id: "robot-q1",
        question: "Welchen Vorteil bietet das Keyword-Driven-Testing im Robot Framework bei Ausschreibungen?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Tests können in lesbarer, fachnaher Sprache formuliert werden und fördern die Abstimmung mit Fachabteilungen.",
          },
          {
            id: "opt-2",
            text: "Es macht die Ausführung von Tests um den Faktor 100 schneller als jeder Code.",
          },
          {
            id: "opt-3",
            text: "Es verhindert vollständig, dass Softwarefehler in Produktion gelangen.",
          },
          {
            id: "opt-4",
            text: "Es ersetzt die Notwendigkeit von Testdaten und Testumgebungen.",
          },
        ],
        correctOptionIds: ["opt-1"],
        explanation:
          "Keyword-getriebene Ansätze ermöglichen es sowohl Fachexperten als auch Testern, Testfälle transparent zu verstehen und gemeinsam zu pflegen.",
      },
      {
        id: "robot-q2",
        question:
          "Welche Komponenten gehören typischerweise zur Architektur einer Robot-Framework-Testsuite? (Wähle alle zutreffenden Antworten)",
        type: "multiple",
        options: [
          {
            id: "opt-1",
            text: "Testfälle mit standardisierten oder benutzerdefinierten Keywords",
          },
          {
            id: "opt-2",
            text: "Bibliotheken (z. B. SeleniumLibrary, Browser, RequestsLibrary)",
          },
          {
            id: "opt-3",
            text: "HTML-Report und XML-Ergebnisprotokollierung (output.xml, log.html)",
          },
          {
            id: "opt-4",
            text: "Ein proprietärer Compiler, der den Code in Maschinensprache übersetzt",
          },
        ],
        correctOptionIds: ["opt-1", "opt-2", "opt-3"],
        explanation:
          "Robot Framework ist Python-basiert und modular aufgebaut aus Testdateien, Bibliotheken und integriertem Reporting.",
      },
    ],
  },
  {
    id: "istqb-advanced-tta",
    slug: "istqb-advanced-tta",
    title: "ISTQB Advanced TTA",
    category: "ISTQB",
    description:
      "Vertiefungskurs für Technical Test Analysts: Strukturorientierte Testverfahren, Codeüberdeckung und nicht-funktionale Tests.",
    isDemo: true,
    demoNotice:
      "Hinweis: Dieser Kurs befindet sich in redaktioneller Vorbereitung. Die Übungsfragen dienen der Veranschaulichung.",
    materials: [],
    questions: [
      {
        id: "tta-q1",
        question: "Welcher Überdeckungsgrad wird durch die Zweigüberdeckung (Branch Coverage) gemessen?",
        type: "single",
        options: [
          {
            id: "opt-1",
            text: "Der Anteil der im Kontrollflussgraphen durchlaufenen Kanten bzw. Verzweigungen.",
          },
          {
            id: "opt-2",
            text: "Nur die Anzahl der fehlerfrei kompilierten Codezeilen.",
          },
          {
            id: "opt-3",
            text: "Der prozentuale Anteil der getesteten Datenbanktabellen.",
          },
          {
            id: "opt-4",
            text: "Die Anzahl der Benutzer, die das System gleichzeitig nutzen können.",
          },
        ],
        correctOptionIds: ["opt-1"],
        explanation:
          "Zweigüberdeckung misst das Verhältnis der durchlaufenen Zweige (True/False-Ausgänge von Entscheidungen) zu allen möglichen Zweigen im Kontrollfluss.",
      },
    ],
  },
];

export function getCourses(): Course[] {
  return coursesData;
}

export function getCourseBySlug(slug: string): Course | undefined {
  return coursesData.find((course) => course.slug === slug || course.id === slug);
}
