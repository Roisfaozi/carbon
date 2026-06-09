import { useMode } from "@carbon/react";
import { LuMoon, LuSun } from "react-icons/lu";
import { useFetcher } from "react-router";

// Uses the app's canonical mode mechanism: POST the new mode to the root action
// (public — works signed-out), which sets the cookie and flips the theme
// optimistically via useMode(). No reload.
export function ThemeToggle() {
  const fetcher = useFetcher();
  const mode = useMode();
  const next = mode === "dark" ? "light" : "dark";

  return (
    <fetcher.Form method="post" action="/">
      <input type="hidden" name="mode" value={next} />
      <button
        type="submit"
        aria-label={
          mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground hover:border-muted-foreground transition-[transform,border-color] duration-150 active:scale-[0.96]"
      >
        {mode === "dark" ? <LuSun size={16} /> : <LuMoon size={16} />}
      </button>
    </fetcher.Form>
  );
}
