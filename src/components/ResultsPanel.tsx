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
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { MortgageAnalysisResult, ExtractionField, Evidence, FieldConsensusDetail } from "@/types/mortgage";
import { cn } from "@/lib/utils";
import { ConsensusBar } from "@/components/ConsensusBar";

interface ResultsPanelProps {
  result: MortgageAnalysisResult;
  onShowEvidence: (page: number, text: string) => void;
  onConfirm?: (editedResult: MortgageAnalysisResult) => void;
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

function ConsensusIndicator({ consensus }: { consensus?: FieldConsensusDetail }) {
  if (!consensus) return null;
  if (consensus.status === "full") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400" title={`Acuerdo: ${consensus.models_agreed.join(", ")}`}>
        <CheckCircle2 className="h-3 w-3" />
        3/3
      </span>
    );
  }
  if (consensus.status === "partial") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400" title={`Acuerdo parcial: ${consensus.models_agreed.join(", ")}`}>
        <AlertTriangle className="h-3 w-3" />
        2/3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-destructive" title="Sin acuerdo entre modelos">
      <AlertTriangle className="h-3 w-3" />
      0/3
    </span>
  );
}

function FieldCard({
  label,
  field,
  unit,
  onShowEvidence,
  isConfirmed,
  onValueChange,
  consensus,
}: {
  label: string;
  field: ExtractionField;
  unit: string;
  onShowEvidence: (page: number, text: string) => void;
  isConfirmed: boolean;
  onValueChange: (value: string) => void;
  consensus?: FieldConsensusDetail;
}) {
  const displayValue = field.value !== null ? String(field.value) : "";

  const noConsensus = consensus?.status === "none";
  const isLowConfidence = !isConfirmed && (field.confidence < 0.5 || noConsensus);
  const isMedConfidence = !isConfirmed && !noConsensus && field.confidence >= 0.5 && field.confidence < 0.8;

  return (
    <Card className={cn(
      "overflow-hidden transition-colors",
      noConsensus && "border-destructive/60 bg-destructive/5",
      isLowConfidence && !noConsensus && "border-destructive/60 bg-destructive/5",
      isMedConfidence && "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20",
      consensus?.status === "partial" && "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20",
    )}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <div className="flex items-center gap-1.5">
            <ConsensusIndicator consensus={consensus} />
            <ConfidenceBadge value={field.confidence} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <span className="text-lg font-semibold text-foreground">{displayValue || "—"}</span>
          ) : (
            <Input
              value={displayValue}
              onChange={(e) => onValueChange(e.target.value)}
              className={cn(
                "h-8 text-lg font-semibold",
                (isLowConfidence || noConsensus) && "border-destructive/60 focus-visible:ring-destructive/30",
              )}
              placeholder="—"
            />
          )}
          <span className="text-sm text-muted-foreground whitespace-nowrap">{unit}</span>
        </div>
        {noConsensus && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sin acuerdo entre modelos — revisa manualmente
          </p>
        )}
        {!noConsensus && isLowConfidence && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Confianza baja — revisa este valor
          </p>
        )}
        <EvidenceLinks evidence={field.evidence} onShowEvidence={onShowEvidence} />
      </CardContent>
    </Card>
  );
}

export function ResultsPanel({ result, onShowEvidence, onConfirm }: ResultsPanelProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [editedResult, setEditedResult] = useState<MortgageAnalysisResult>(result);
  const ext = editedResult.extraction;
  const consensus = editedResult.consensus;

  const updateField = (fieldName: keyof typeof ext, value: string) => {
    setEditedResult((prev) => ({
      ...prev,
      extraction: {
        ...prev.extraction,
        [fieldName]: {
          ...(prev.extraction[fieldName] as ExtractionField),
          value: value === "" ? null : parseFloat(value) || null,
        },
      },
    }));
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    onConfirm?.(editedResult);
    toast({ title: "Datos confirmados", description: "Los datos han sido validados correctamente" });
  };

  const handleEdit = () => {
    setIsConfirmed(false);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(editedResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analisis_${editedResult.document_meta.file_name.replace(".pdf", "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildCopyText = () => {
    const lines: string[] = [];
    const tipo = ext.tipo_hipoteca === "mixta" ? "Mixta" : ext.tipo_hipoteca === "variable" ? "Variable" : "Fija";
    lines.push(`1. Tipo de hipoteca: ${tipo}`);
    lines.push(`2. TIN Bonificado: ${ext.tin_bonificado.value !== null ? `${ext.tin_bonificado.value}%` : "—"}`);
    lines.push(`3. TIN Sin Bonificar: ${ext.tin_sin_bonificar.value !== null ? `${ext.tin_sin_bonificar.value}%` : "—"}`);
    lines.push(`4. TAE: ${ext.tae.value !== null ? `${ext.tae.value}%` : "—"}`);
    lines.push(`5. Cuota Final: ${ext.cuota_final.value !== null ? `${ext.cuota_final.value} €/mes` : "—"}`);

    if (ext.bonificaciones.items.length > 0) {
      lines.push(`6. Bonificaciones (${ext.bonificaciones.count}):`);
      ext.bonificaciones.items.forEach((b, i) => {
        let detail = `   ${i + 1}. ${b.name}`;
        if (b.cost.value !== null) detail += ` — Coste: ${b.cost.value} ${b.cost.unit}${b.cost.period ? `/${b.cost.period}` : ""}`;
        if (b.weight.value !== null) detail += ` — Impacto: ${b.weight.value > 0 ? "−" : ""}${Math.abs(b.weight.value)} ${b.weight.unit}`;
        lines.push(detail);
      });
    }

    if (ext.alternatives.length > 0) {
      const nextNum = ext.bonificaciones.items.length > 0 ? 7 : 6;
      lines.push(`${nextNum}. Escenarios alternativos:`);
      ext.alternatives.forEach((alt, i) => {
        let detail = `   ${i + 1}. ${alt.scenario}`;
        if (alt.tin_bonificado !== null) detail += ` | TIN bonif.: ${alt.tin_bonificado}%`;
        if (alt.cuota !== null) detail += ` | Cuota: ${alt.cuota} €/mes`;
        lines.push(detail);
      });
    }

    return lines.join("\n");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildCopyText());
    toast({ title: "Copiado al portapapeles" });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Resultados del análisis</h2>
              {ext.tipo_hipoteca && (
                <Badge variant={ext.tipo_hipoteca === "mixta" ? "default" : "secondary"}>
                  {ext.tipo_hipoteca === "fija" ? "Fija" : ext.tipo_hipoteca === "variable" ? "Variable" : "Mixta"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {editedResult.document_meta.file_name} · {editedResult.document_meta.pages} páginas
            </p>
          </div>
          <div className="flex gap-2">
            {!isConfirmed ? (
              <Button size="sm" onClick={handleConfirm}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Confirmar datos
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            )}
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

        {/* Status banner */}
        {isConfirmed ? (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-300">Datos confirmados</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400">
              Los datos han sido revisados y aceptados.
              <Button variant="link" size="sm" onClick={handleEdit} className="ml-2 h-auto p-0 text-green-700 dark:text-green-400">
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Pencil className="h-4 w-4" />
            <AlertTitle>Revisión pendiente</AlertTitle>
            <AlertDescription>
              Revisa los datos extraídos y edítalos si es necesario antes de confirmar.
            </AlertDescription>
          </Alert>
        )}

        {/* Consensus bar */}
        {consensus && <ConsensusBar consensus={consensus} />}

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
          <FieldCard label="TIN Bonificado" field={ext.tin_bonificado} unit="%" onShowEvidence={onShowEvidence} isConfirmed={isConfirmed} onValueChange={(v) => updateField("tin_bonificado", v)} consensus={consensus?.details?.tin_bonificado} />
          <FieldCard label="TIN Sin Bonificar" field={ext.tin_sin_bonificar} unit="%" onShowEvidence={onShowEvidence} isConfirmed={isConfirmed} onValueChange={(v) => updateField("tin_sin_bonificar", v)} consensus={consensus?.details?.tin_sin_bonificar} />
          <FieldCard label="TAE" field={ext.tae} unit="%" onShowEvidence={onShowEvidence} isConfirmed={isConfirmed} onValueChange={(v) => updateField("tae", v)} consensus={consensus?.details?.tae} />
          <FieldCard label="Cuota Final" field={ext.cuota_final} unit="€/mes" onShowEvidence={onShowEvidence} isConfirmed={isConfirmed} onValueChange={(v) => updateField("cuota_final", v)} consensus={consensus?.details?.cuota_final} />
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

        {/* Confirmed status */}
        {isConfirmed && (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Análisis completado y confirmado</span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
