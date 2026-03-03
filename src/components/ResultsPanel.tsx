import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Copy,
  Download,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { MortgageAnalysisResult, ExtractionField, Evidence } from "@/types/mortgage";
import { cn } from "@/lib/utils";

interface ResultsPanelProps {
  result: MortgageAnalysisResult;
  onShowEvidence: (page: number, text: string) => void;
}

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 0.8
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : value >= 0.5
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {(value * 100).toFixed(0)}%
    </span>
  );
}

function EvidenceLinks({
  evidence,
  onShowEvidence,
}: {
  evidence: Evidence[];
  onShowEvidence: (page: number, text: string) => void;
}) {
  if (!evidence.length) return null;
  return (
    <div className="mt-1">
      {evidence.map((ev, i) => (
        <button
          key={i}
          onClick={() => onShowEvidence(ev.page, ev.text)}
          className="mr-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <Eye className="h-3 w-3" />
          Pág. {ev.page}
        </button>
      ))}
    </div>
  );
}

function FieldCard({
  label,
  field,
  unit,
  onShowEvidence,
}: {
  label: string;
  field: ExtractionField;
  unit: string;
  onShowEvidence: (page: number, text: string) => void;
}) {
  const [editValue, setEditValue] = useState(field.value !== null ? String(field.value) : "");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <ConfidenceBadge value={field.confidence} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-lg font-semibold"
            placeholder="—"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">{unit}</span>
        </div>
        <EvidenceLinks evidence={field.evidence} onShowEvidence={onShowEvidence} />
      </CardContent>
    </Card>
  );
}

export function ResultsPanel({ result, onShowEvidence }: ResultsPanelProps) {
  const { extraction: ext } = result;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analisis_${result.document_meta.file_name.replace(".pdf", "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast({ title: "Copiado al portapapeles" });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Resultados del análisis</h2>
            <p className="text-xs text-muted-foreground">
              {result.document_meta.file_name} · {result.document_meta.pages} páginas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              <Download className="h-3.5 w-3.5 mr-1" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copiar
            </Button>
          </div>
        </div>

        {/* Review warnings */}
        {ext.needs_review && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Requiere revisión</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 text-xs mt-1">
                {ext.review_notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Main fields */}
        <div className="grid grid-cols-2 gap-3">
          <FieldCard label="TIN Bonificado" field={ext.tin_bonificado} unit="%" onShowEvidence={onShowEvidence} />
          <FieldCard label="TIN Sin Bonificar" field={ext.tin_sin_bonificar} unit="%" onShowEvidence={onShowEvidence} />
          <FieldCard label="TAE" field={ext.tae} unit="%" onShowEvidence={onShowEvidence} />
          <FieldCard label="Cuota Final" field={ext.cuota_final} unit="€/mes" onShowEvidence={onShowEvidence} />
        </div>

        {/* Bonificaciones */}
        {ext.bonificaciones.items.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">
                Bonificaciones ({ext.bonificaciones.count})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 space-y-3">
              {ext.bonificaciones.items.map((bonif, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground">{bonif.name}</span>
                    <ConfidenceBadge value={bonif.confidence} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {bonif.cost.value !== null && (
                      <p>
                        Coste: {bonif.cost.value} {bonif.cost.unit}
                        {bonif.cost.period && ` / ${bonif.cost.period}`}
                      </p>
                    )}
                    {bonif.weight.value !== null && (
                      <p>
                        Impacto: {bonif.weight.value > 0 ? "−" : ""}
                        {Math.abs(bonif.weight.value)} {bonif.weight.unit}
                        {bonif.weight.notes && ` (${bonif.weight.notes})`}
                      </p>
                    )}
                  </div>
                  <EvidenceLinks evidence={bonif.evidence} onShowEvidence={onShowEvidence} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Alternatives */}
        {ext.alternatives.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Escenarios alternativos</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 space-y-2">
              {ext.alternatives.map((alt, i) => (
                <div key={i} className="rounded-lg border p-3 text-xs">
                  <p className="font-medium text-foreground mb-1">{alt.scenario}</p>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    {alt.tin_bonificado !== null && <p>TIN bonif.: {alt.tin_bonificado}%</p>}
                    {alt.tin_sin_bonificar !== null && <p>TIN s/b.: {alt.tin_sin_bonificar}%</p>}
                    {alt.tae !== null && <p>TAE: {alt.tae}%</p>}
                    {alt.cuota !== null && <p>Cuota: {alt.cuota} €/mes</p>}
                  </div>
                  {alt.notes && <p className="text-muted-foreground mt-1">{alt.notes}</p>}
                  <EvidenceLinks evidence={alt.evidence} onShowEvidence={onShowEvidence} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Success indicator */}
        {!ext.needs_review && (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Análisis completado sin inconsistencias</span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
