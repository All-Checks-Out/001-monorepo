import { Button } from "@frontend/shadcn/components/ui/button";
import { Link } from "react-router-dom";
import { CORE_ROUTES } from "../constants/routes";

const NotFound = () => {
  return (
    <div className="mx-auto max-w-7xl p-4 pt-0">
      <div className="rounded-md border bg-card p-6 text-center shadow">
        <p className="mb-1 text-sm text-muted-foreground">404</p>
        <h1 className="mb-2 text-lg font-semibold">Page not found</h1>
        <p className="mb-6 text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <Button asChild>
          <Link to={CORE_ROUTES.home}>Back to home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
