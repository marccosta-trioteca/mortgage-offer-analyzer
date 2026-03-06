import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { MortgageAnalysisResult, ExtractionField } from "@/types/mortgage";
import { cn } from "@/lib/utils";

interface ComparisonRecord {
  result: MortgageAnalysisResult;
  fileName: string;
  date: string;
}

interface ComparisonViewProps {
  items: [ComparisonRecord, ComparisonRecord];
  onClose: () => void;
}

function DiffIndicator({ a, b }: { a: number | null; b: number | null }) {
  if (a == null || b == null) return null;
  const diff = b - a;
  if (Math.abs(diff) < 0.001) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (diff > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-destructive font-medium">
        <ArrowUp className="h-3 w-3" />+{diff.toFixed(2)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400 font-medium">
      <ArrowDown className="h-3 w-3" />{diff.toFixed(2)}
    </span>
  );
}

function FieldRow({
  label,
  unit,
  fieldA,
  fieldB,
}: {
  label: string;
  unit: string;
  fieldA: ExtractionField;
  fieldB: ExtractionField;
}) {
  const valA = fieldA.value;
  const valB = fieldB.value;
  const isDifferent = valA !== valB;

  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-lg px-3 py-2",
      isDifferent && "bg-accent/60"
    )}>
      <div className="text-right">
        <span className="text-sm font-semibold text-foreground">
          {valA != null ? `${valA} ${unit}` : "—"}
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <DiffIndicator a={valA} b={valB} />
      </div>
      <div className="text-left">
        <span className="text-sm font-semibold text-foreground">
          {valB != null ? `${valB} ${unit}` : "—"}
        </span>
      </div>
    </div>
  );
}

export function ComparisonView({ items, onClose }: ComparisonViewProps) {
  const [a, b] = items;
  const extA = a.result.extraction;
  const extB = b.result.extraction;

  const tipoLabel = (t: string) =>
    t === "fija" ? "Fija" : t === "variable" ? "Variable" : "Mixta";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-bold text-foreground">Comparación de análisis</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
            <Card className="border-primary/30">
              <CardContent className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{a.fileName}</p>
                <p className="text-[10px] text-muted-foreground">{a.date}</p>
                {extA.tipo_hipoteca && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {tipoLabel(extA.tipo_hipoteca)}
                  </Badge>
                )}
              </CardContent>
            </Card>
            <div className="min-w-[80px] flex items-center justify-center pt-3">
              <span className="text-xs font-medium text-muted-foreground">vs</span>
            </div>
            <Card className="border-primary/30">
              <CardContent className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{b.fileName}</p>
                <p className="text-[10px] text-muted-foreground">{b.date}</p>
                {extB.tipo_hipoteca && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {tipoLabel(extB.tipo_hipoteca)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Field comparisons */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Datos principales</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3 pt-0 space-y-1">
              <FieldRow label="TIN Bonif." unit="%" fieldA={extA.tin_bonificado} fieldB={extB.tin_bonificado} />
              <FieldRow label="TIN S/B" unit="%" fieldA={extA.tin_sin_bonificar} fieldB={extB.tin_sin_bonificar} />
              <FieldRow label="TAE" unit="%" fieldA={extA.tae} fieldB={extB.tae} />
              <FieldRow label="Cuota" unit="€/mes" fieldA={extA.cuota_final} fieldB={extB.cuota_final} />
            </CardContent>
          </Card>

          {/* Bonificaciones comparison */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Bonificaciones</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
                <div className="space-y-1">
                  {extA.bonificaciones.items.length > 0 ? (
                    extA.bonificaciones.items.map((b, i) => (
                      <div key={i} className="text-xs rounded border p-2">
                        <p className="font-medium text-foreground">{b.name}</p>
                        {b.cost.value != null && (
                          <p className="text-muted-foreground">
                            {b.cost.value} {b.cost.unit}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin bonificaciones</p>
                  )}
                </div>
                <div className="min-w-[80px]" />
                <div className="space-y-1">
                  {extB.bonificaciones.items.length > 0 ? (
                    extB.bonificaciones.items.map((b, i) => (
                      <div key={i} className="text-xs rounded border p-2">
                        <p className="font-medium text-foreground">{b.name}</p>
                        {b.cost.value != null && (
                          <p className="text-muted-foreground">
                            {b.cost.value} {b.cost.unit}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin bonificaciones</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
