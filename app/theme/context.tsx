import * as React from "react";

import { DEFAULT_THEME, type Theme } from "./theme";

interface ThemeContextValue {
  theme: Theme;
  /** changeTheme shows another theme at once (see `useSetTheme`, which also
   * remembers it). Undefined outside the provider. */
  changeTheme?: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
});

/** ThemeProvider makes the color theme available to `useTheme`. The theme
 * comes from the root loader, so the server and the browser render the same
 * `<html data-theme>`. */
export function ThemeProvider({
  theme,
  onChangeTheme,
  children,
}: {
  theme: Theme;
  onChangeTheme?: (theme: Theme) => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ theme, changeTheme: onChangeTheme }),
    [theme, onChangeTheme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
