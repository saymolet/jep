import clsx from "clsx";
import * as React from "react";

/** fitScale is how much content of `contentHeight` must shrink to fit in
 * `boxHeight` (1 = fits; it never grows). */
export function fitScale(boxHeight: number, contentHeight: number) {
  if (boxHeight <= 0 || contentHeight <= 0) return 1;
  return Math.min(1, boxHeight / contentHeight);
}

/** FitToBox shrinks its content (CSS scale, centered) until it fits the
 * box's height, so a big screen never has to scroll: the TV board on a
 * laptop with display scaling (1280x720 CSS pixels) shows every row. The
 * content keeps its full width. */
export function FitToBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState({ scale: 1, offset: 0 });

  React.useEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    const update = () => {
      // offsetHeight ignores the transform: the content's natural height.
      const contentHeight = content.offsetHeight;
      const scale = fitScale(box.clientHeight, contentHeight);
      const offset = Math.max(
        0,
        (box.clientHeight - contentHeight * scale) / 2,
      );
      setFit((prev) =>
        prev.scale === scale && prev.offset === offset
          ? prev
          : { scale, offset },
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className={clsx("relative min-h-0 grow overflow-hidden", className)}
      data-testid="fit-to-box"
    >
      <div
        ref={contentRef}
        className="absolute inset-x-0 top-0"
        data-fit-scale={fit.scale}
        style={{
          transform: `translateY(${fit.offset}px) scale(${fit.scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
