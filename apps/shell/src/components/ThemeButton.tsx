import { useTheme } from "@frontend/auth/session/ThemeProvider";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Moon, Sun } from "lucide-react";

export const ThemeButton = () => {
  const { dark, setDark } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      title={dark ? "Use light mode" : "Use dark mode"}
      onClick={() => {
        setDark(!dark);
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
};
