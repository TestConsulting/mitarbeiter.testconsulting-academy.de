import { useEffect, useState } from "react";
import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Navigate, useNavigate } from "react-router-dom";
import type { Course, CourseInput } from "@portal/shared";
import { canManagePortal } from "@portal/shared";
import { api } from "../../api/client.js";
import { useAuth } from "../../app/auth-context.js";
import { CourseEditorDialog } from "./course-editor-dialog.js";

export function CourseCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryLoadError, setCategoryLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setCategoryLoadError(false);
    api.courses.list().then((courses) => {
      if (active) setCategories([...new Set(courses.map((course) => course.category))]);
    }).catch(() => {
      if (active) setCategoryLoadError(true);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  if (!canManagePortal(user)) {
    return <Navigate to="/areas/elearning" replace />;
  }

  async function createCourse(input: CourseInput): Promise<Course> {
    return api.courses.create(input);
  }

  function closeEditor(course?: Course) {
    navigate(course ? `/areas/elearning/${course.slug}` : "/areas/elearning");
  }

  return (
    <>
      {categoryLoadError && (
        <MessageBar intent="error">
          <MessageBarBody>
            Vorhandene Kategorien konnten nicht geladen werden.
            <Button appearance="transparent" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
          </MessageBarBody>
        </MessageBar>
      )}
      <CourseEditorDialog
        presentation="page"
        categories={categories}
        onSave={createCourse}
        onClose={closeEditor}
      />
    </>
  );
}
