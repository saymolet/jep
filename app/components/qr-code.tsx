import * as React from "react";

import { qrSvg } from "~/utils/qr";

/** QrCode renders text (a URL) as a QR code SVG: dark modules on a white
 * square, which scales to any size without blurring. It renders the same on
 * the server and the client. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** Accessible name, e.g. "QR code to join the game". */
  label: string;
  className?: string;
}) {
  const { size, path } = React.useMemo(() => qrSvg(value), [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
      data-testid="join-qr"
      data-value={value}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
