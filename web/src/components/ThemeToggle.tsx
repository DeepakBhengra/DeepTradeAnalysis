import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="cursor-pointer rounded-sm border border-kite-border bg-kite-surface px-2.5 py-1 text-xs text-kite-text hover:bg-kite-bg"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
