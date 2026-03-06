import { useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X, ArrowUp, ArrowDown, Minus, Trophy, Download, Image, Loader2 } from "lucide-react";
import type { MortgageAnalysisResult, ExtractionField } from "@/types/mortgage";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export interface ComparisonRecord {
  result: MortgageAnalysisResult;
  fileName: string;
  date?: string;
}

interface ComparisonViewProps {
  items: ComparisonRecord[];
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
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>
      <ArrowDown className="h-3 w-3" />{diff.toFixed(2)}
    </span>
  );
}

function findBestIndex(values: (number | null)[], lower: boolean): number | null {
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  values.forEach((v, i) => {
    if (v == null) return;
    if (bestVal == null || (lower ? v < bestVal : v > bestVal)) {
      bestVal = v;
      bestIdx = i;
    }
  });
  // Only highlight if there are at least 2 non-null values and they differ
  const nonNull = values.filter((v) => v != null);
  if (nonNull.length < 2 || new Set(nonNull).size === 1) return null;
  return bestIdx;
}

const tipoLabel = (t: string) =>
  t === "fija" ? "Fija" : t === "variable" ? "Variable" : "Mixta";

export function ComparisonView({ items, onClose }: ComparisonViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  if (items.length === 0) return null;

  const exportAsImage = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `comparacion_hipotecas_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Imagen descargada" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al exportar imagen", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportAsPdf = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;
      const pdfW = 210; // A4 mm
      const pdfH = (imgH * pdfW) / imgW;
      const pdf = new jsPDF("p", "mm", [pdfW, Math.max(pdfH, 297)]);
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`comparacion_hipotecas_${Date.now()}.pdf`);
      toast({ title: "PDF descargado" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al exportar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // ... keep existing code for fields array

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-bold text-foreground">
          Comparación de {items.length} ofertas
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAsImage} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsPdf} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(() => {
        const fields = [
          { key: "tin_bonificado", label: "TIN Bonificado", unit: "%", lowerBetter: true },
          { key: "tin_sin_bonificar", label: "TIN Sin Bonificar", unit: "%", lowerBetter: true },
          { key: "tae", label: "TAE", unit: "%", lowerBetter: true },
          { key: "cuota_final", label: "Cuota Final", unit: "€/mes", lowerBetter: true },
        ];
        return null;
      })()}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Comparison table */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Datos principales</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-3 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px] text-xs">Campo</TableHead>
                      {items.map((item, i) => (
                        <TableHead key={i} className="text-xs text-center min-w-[120px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-medium truncate max-w-[140px]">{item.fileName}</span>
                            {item.result.extraction.tipo_hipoteca && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                {tipoLabel(item.result.extraction.tipo_hipoteca)}
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => {
                      const values = items.map(
                        (item) => (item.result.extraction[field.key as keyof typeof item.result.extraction] as ExtractionField)?.value ?? null
                      );
                      const bestIdx = findBestIndex(values, field.lowerBetter);

                      return (
                        <TableRow key={field.key}>
                          <TableCell className="text-xs font-medium text-muted-foreground py-2">
                            {field.label}
                          </TableCell>
                          {values.map((val, i) => (
                            <TableCell
                              key={i}
                              className={cn(
                                "text-center py-2",
                                bestIdx === i && "bg-primary/5"
                              )}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {bestIdx === i && (
                                  <Trophy className="h-3 w-3 text-primary" />
                                )}
                                <span
                                  className={cn(
                                    "text-sm font-semibold",
                                    bestIdx === i ? "text-primary" : "text-foreground"
                                  )}
                                >
                                  {val != null ? `${val} ${field.unit}` : "—"}
                                </span>
                              </div>
                              {/* Diff vs first item */}
                              {i > 0 && values[0] != null && val != null && (
                                <div className="mt-0.5">
                                  <DiffIndicator a={values[0]} b={val} />
                                </div>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Bonificaciones per item */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Bonificaciones</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className={cn("grid gap-4", `grid-cols-${Math.min(items.length, 4)}`)}>
                {items.map((item, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-xs font-medium text-foreground truncate border-b pb-1">
                      {item.fileName}
                    </p>
                    {item.result.extraction.bonificaciones.items.length > 0 ? (
                      item.result.extraction.bonificaciones.items.map((b, j) => (
                        <div key={j} className="text-xs rounded border p-2">
                          <p className="font-medium text-foreground">{b.name}</p>
                          {b.cost.value != null && (
                            <p className="text-muted-foreground">
                              {b.cost.value} {b.cost.unit}
                              {b.cost.period ? ` / ${b.cost.period}` : ""}
                            </p>
                          )}
                          {b.weight.value != null && (
                            <p className="text-muted-foreground">
                              Impacto: {b.weight.value > 0 ? "−" : ""}
                              {Math.abs(b.weight.value)} {b.weight.unit}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin bonificaciones</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="text-xs text-muted-foreground space-y-1">
                {fields.map((field) => {
                  const values = items.map(
                    (item) => (item.result.extraction[field.key as keyof typeof item.result.extraction] as ExtractionField)?.value ?? null
                  );
                  const bestIdx = findBestIndex(values, field.lowerBetter);
                  if (bestIdx == null) return null;
                  return (
                    <p key={field.key}>
                      <span className="font-medium text-foreground">{field.label}:</span>{" "}
                      Mejor oferta en{" "}
                      <span className="font-medium text-primary">{items[bestIdx].fileName}</span>{" "}
                      ({values[bestIdx]} {field.unit})
                    </p>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
