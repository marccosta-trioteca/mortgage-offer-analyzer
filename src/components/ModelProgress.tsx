import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModelStatus {
  label: string;
  status: "pending" | "running" | "success" | "error";
}

interface ModelProgressProps {
  models: ModelStatus[];
}

export function ModelProgress({ models }: ModelProgressProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Analizando con 3 modelos IA...</p>
      <div className="space-y-1.5">
        {models.map((model) => (
          <div
            key={model.label}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all",
              model.status === "success" && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
              model.status === "error" && "border-destructive/50 bg-destructive/5",
              model.status === "running" && "border-primary/50 bg-primary/5",
              model.status === "pending" && "border-border bg-muted/30",
            )}
          >
            {model.status === "pending" && (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
            )}
            {model.status === "running" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {model.status === "success" && (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
            {model.status === "error" && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={cn(
              "font-medium",
              model.status === "success" && "text-green-700 dark:text-green-300",
              model.status === "error" && "text-destructive",
              model.status === "running" && "text-primary",
              model.status === "pending" && "text-muted-foreground",
            )}>
              {model.label}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {model.status === "pending" && "En espera"}
              {model.status === "running" && "Procesando..."}
              {model.status === "success" && "Completado ✓"}
              {model.status === "error" && "Error ✗"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
