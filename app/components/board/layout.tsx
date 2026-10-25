import clsx from "clsx";
import * as React from "react";

import { useTranslation } from "~/i18n";

/** Boards with up to this many categories keep the classic layout. */
export const CLASSIC_MAX_COLUMNS = 5;
/** Narrowest column of a wide board: still a comfortable tap target. Boards
 * whose columns would be narrower than this scroll sideways instead. */
export const MIN_COLUMN_WIDTH_PX = 44;
/** Widest column of a wide board, so many categories can use a big screen
 * instead of staying as narrow as a 5-category board. */
const MAX_COLUMN_WIDTH_PX = 200;
/** Max width of the classic board (Tailwind's max-w-screen-lg). */
const CLASSIC_MAX_WIDTH_PX = 1024;

/** The dollar values on a wide board scale with the column width (the board
 * container is a CSS size container, so 100cqw is the board's width). A
 * 4-digit value with its smaller "$" is about 3em wide. */
const WIDE_VALUE_FONT_SIZE =
  "clamp(0.75rem, calc((100cqw / var(--board-columns) - 0.25rem) / 3.1), 3rem)";

const BoardColumnsContext = React.createContext(CLASSIC_MAX_COLUMNS);

/** useIsWideBoard is true inside a board with more than 5 categories. */
export function useIsWideBoard() {
  return React.useContext(BoardColumnsContext) > CLASSIC_MAX_COLUMNS;
}

/** getCellPaddingClassName is the padding inside a board cell. */
export function getCellPaddingClassName(wide: boolean) {
  return wide ? "min-h-11 px-0.5 py-2 sm:px-2 sm:py-3" : "px-4 py-3";
}

export function getClueButtonClassName({
  loading = false,
  playable,
  wide = false,
}: {
  loading?: boolean;
  playable: boolean;
  wide?: boolean;
}) {
  return clsx(
    "group relative h-full w-full bg-blue-bright transition-colors",
    getCellPaddingClassName(wide),
    {
      "hover:bg-blue-700 focus:bg-blue-700": playable,
      "bg-slate-800": !playable,
      "border-spin opacity-75": loading,
    },
  );
}

/** ClueValue renders a clue's "$" and value at a size that fits the board's
 * columns. */
export function ClueValue({
  value,
  showDollar = true,
}: {
  value: React.ReactNode;
  showDollar?: boolean;
}) {
  const wide = useIsWideBoard();
  if (wide) {
    return (
      <span
        className="flex items-center justify-center gap-0.5 leading-tight"
        style={{ fontSize: WIDE_VALUE_FONT_SIZE }}
      >
        {showDollar ? <span className="text-[0.7em]">$</span> : null}
        <span>{value}</span>
      </span>
    );
  }
  return (
    <>
      {showDollar ? (
        <span className="text-sm sm:text-3xl lg:text-4xl">$</span>
      ) : null}
      <span className="text-md sm:text-4xl lg:text-5xl">{value}</span>
    </>
  );
}

/** BoardScroller sizes a board for its number of columns.
 *
 * Up to 5 columns the board looks as it always has (at most 1024px wide).
 * Wider boards may grow up to 200px per column on big screens, and their
 * text scales with the column width. On a phone the columns shrink down to
 * 44px — 8 categories fit a 390px-wide screen — and boards with even more
 * categories scroll sideways inside this container rather than shrinking the
 * tap targets further.
 */
export function BoardScroller({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: number;
}) {
  const wide = columns > CLASSIC_MAX_COLUMNS;
  const style: React.CSSProperties & Record<`--${string}`, string | number> =
    wide
      ? {
          minWidth: `${columns * MIN_COLUMN_WIDTH_PX}px`,
          maxWidth: `${Math.max(CLASSIC_MAX_WIDTH_PX, columns * MAX_COLUMN_WIDTH_PX)}px`,
          "--board-columns": columns,
        }
      : { minWidth: `${columns * 50}px` };
  return (
    <BoardColumnsContext.Provider value={columns}>
      <div className="w-full overflow-x-auto" data-testid="board-scroller">
        <div
          className={clsx("mx-auto", wide ? "@container" : "max-w-screen-lg")}
          style={style}
          data-columns={columns}
        >
          {children}
        </div>
      </div>
    </BoardColumnsContext.Provider>
  );
}

export function BoardLayout({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: number;
}) {
  return (
    <BoardScroller columns={columns}>
      <table className="h-1 w-full table-fixed bg-blue-bright text-white">
        {children}
      </table>
    </BoardScroller>
  );
}

/** EmptyCell fills the grid where a category has fewer clues than the
 * longest one. */
export function EmptyCell() {
  return (
    <td
      aria-hidden
      data-testid="empty-cell"
      className="h-full border-2 border-blue-925 bg-blue-1000"
    />
  );
}

export function EmptyBoard({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}) {
  const { t } = useTranslation();
  const wide = columns > CLASSIC_MAX_COLUMNS;
  return (
    <BoardLayout columns={columns}>
      <thead>
        <tr className="h-1">
          {Array.from({ length: columns }, (_, column) => (
            <th
              key={column}
              className="h-full border-2 border-blue-925 bg-black/30 leading-none sm:p-4"
            >
              <span className="block h-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, row) => (
          <tr key={row}>
            {Array.from({ length: columns }, (_, column) => (
              <td key={column} className="h-full border-2 border-blue-925">
                <button
                  type="button"
                  aria-label={t("room.hiddenClue", {
                    row: row + 1,
                    column: column + 1,
                  })}
                  className={getClueButtonClassName({ playable: true, wide })}
                >
                  <span className="block h-8 sm:h-12 lg:h-14" />
                </button>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </BoardLayout>
  );
}
