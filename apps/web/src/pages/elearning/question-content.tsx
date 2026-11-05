import { useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";
import type { PracticeQuestion } from "@portal/shared";

function QuestionImage({ image }: { image: NonNullable<PracticeQuestion["image"]> }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [baseWidth, setBaseWidth] = useState<number | null>(null);
  const modalImageRef = useRef<HTMLImageElement>(null);

  function close() {
    setOpen(false);
    setZoom(1);
    setBaseWidth(null);
  }

  function changeZoom(nextZoom: number) {
    if (nextZoom === 1) {
      setZoom(1);
      setBaseWidth(null);
      return;
    }

    const measuredWidth = modalImageRef.current?.getBoundingClientRect().width;
    const width = baseWidth ?? (measuredWidth || modalImageRef.current?.naturalWidth || null);
    if (width) setBaseWidth(width);
    setZoom(nextZoom);
  }

  return <>
    <button
      className="question-content__image-button"
      type="button"
      aria-label={`Bild vergrößern: ${image.alt}`}
      onClick={() => {
        setZoom(1);
        setBaseWidth(null);
        setOpen(true);
      }}
    >
      <img className="question-content__image" src={image.url} alt={image.alt} />
    </button>
    <Dialog open={open} onOpenChange={(_event, data) => { if (!data.open) close(); }}>
      <DialogSurface className="question-image-dialog">
        <DialogBody>
          <DialogTitle>Bildansicht: {image.alt}</DialogTitle>
          <DialogContent className="question-image-dialog__content">
            <div className="question-image-dialog__viewport">
              <img
                ref={modalImageRef}
                className="question-image-dialog__image"
                src={image.url}
                alt={image.alt}
                style={baseWidth === null ? undefined : {
                  width: `${baseWidth * zoom}px`,
                  maxWidth: "none",
                  maxHeight: "none",
                }}
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button disabled={zoom <= 0.5} onClick={() => changeZoom(Math.max(0.5, zoom / 1.5))}>
              Verkleinern
            </Button>
            <Button disabled={zoom === 1} onClick={() => changeZoom(1)}>100 %</Button>
            <Button disabled={zoom >= 4} onClick={() => changeZoom(Math.min(4, zoom * 1.5))}>
              Vergrößern
            </Button>
            <Button appearance="primary" onClick={close}>Schließen</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </>;
}

export function QuestionContent({ question }: { question: Pick<PracticeQuestion, "question" | "image"> }) {
  return <span className="question-content">
    {question.question.split("\n").map((line, index) =>
      <span className="question-content__line" key={index}>{line}</span>)}
    {question.image && <QuestionImage image={question.image} />}
  </span>;
}
