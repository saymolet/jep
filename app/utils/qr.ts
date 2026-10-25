import { encode } from "uqr";

/** QR_BORDER is the quiet zone around the code, in modules. Scanners need
 * some light margin around the code to find it. */
const QR_BORDER = 2;

export interface QrSvg {
  /** Width and height of the code in modules, quiet zone included. */
  size: number;
  /** One SVG path drawing every dark module as a 1×1 square. */
  path: string;
}

/** qrSvg encodes text (e.g. a room URL) as a QR code and returns it as one
 * SVG path, so it can be rendered as plain JSX (no innerHTML). The output only
 * depends on the text, so the server and the browser render the same markup
 * (no hydration mismatch). Error correction "M" (15%) keeps the code small
 * for a URL and still scans from across a room. */
export function qrSvg(text: string): QrSvg {
  const { data, size } = encode(text, { ecc: "M", border: QR_BORDER });
  const parts: string[] = [];
  for (let y = 0; y < data.length; y++) {
    const row = data[y];
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      // Merge horizontal runs of dark modules into one rectangle.
      let end = x;
      while (end < row.length && row[end]) end++;
      parts.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      x = end;
    }
  }
  return { size, path: parts.join("") };
}
