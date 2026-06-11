import { useState } from "react";
import { Card, CardContent, Button } from "./ui.jsx";

export function CollapsibleCard({
  title,
  defaultOpen = false,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg">{title}</h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(prev => !prev)}
          >
            {open ? "Hide" : "Show"}
          </Button>
        </div>

        {open ? (
          <div className="mt-4">
            {children}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}