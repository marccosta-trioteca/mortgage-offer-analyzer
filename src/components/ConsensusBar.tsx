import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ConsensusInfo } from "@/types/mortgage";

interface ConsensusBarProps {
  consensus: ConsensusInfo;
}

const FIELD_LABELS: Record<string, string> = {
  tin_bonificado: "TIN Bonificado",
  tin_sin_bonificar: "TIN Sin Bonificar",
  tae: "TAE",
  cuota_final: "Cuota Final",
  tipo_hipoteca: "Tipo Hipoteca",
};

export function ConsensusBar({ consensus }: ConsensusBarProps) {
  const { status, details, models_used, models_failed } = consensus;

  if (status === "full") {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-300">
          Consenso total — 3 modelos de acuerdo
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {models_used.map((m) => (
              <Badge key={m} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs">
                {m}
              </Badge>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "partial") {
    const partialFields = Object.entries(details)
      .filter(([, d]) => d.status === "partial")
      .map(([k]) => FIELD_LABELS[k] || k);
    const noneFields = Object.entries(details)
      .filter(([, d]) => d.status === "none")
      .map(([k]) => FIELD_LABELS[k] || k);

    return (
      <Alert className="border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-300">
          Consenso parcial — revisa los campos marcados
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs space-y-1.5 mt-1">
          <div className="flex gap-1.5 flex-wrap">
            {models_used.map((m) => (
              <Badge key={m} variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs">
                {m}
              </Badge>
            ))}
            {models_failed.map((m) => (
              <Badge key={m} variant="destructive" className="text-xs">
                {m} ✗
              </Badge>
            ))}
          </div>
          {partialFields.length > 0 && (
            <p>⚠ Acuerdo parcial (2/3): {partialFields.join(", ")}</p>
          )}
          {noneFields.length > 0 && (
            <p>✗ Sin acuerdo: {noneFields.join(", ")}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // status === "none"
  return (
    <Alert variant="destructive" className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Sin consenso — no se pudo confirmar la información</AlertTitle>
      <AlertDescription className="text-xs space-y-1.5 mt-1">
        <div className="flex gap-1.5 flex-wrap">
          {models_used.map((m) => (
            <Badge key={m} variant="secondary" className="text-xs">
              {m}
            </Badge>
          ))}
          {models_failed.map((m) => (
            <Badge key={m} variant="destructive" className="text-xs">
              {m} ✗
            </Badge>
          ))}
        </div>
        <p>Los modelos no se pusieron de acuerdo en los valores clave. Revisa manualmente cada campo.</p>
        <div className="mt-1 space-y-0.5">
          {Object.entries(details).map(([field, detail]) => (
            <p key={field}>
              <span className="font-medium">{FIELD_LABELS[field] || field}:</span>{" "}
              {detail.status === "full"
                ? "✓ Acuerdo"
                : detail.status === "partial"
                  ? `⚠ Parcial (${detail.models_agreed.join(", ")})`
                  : "✗ Sin acuerdo"}
            </p>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
