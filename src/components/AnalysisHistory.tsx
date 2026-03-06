import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileText, Trash2, GitCompareArrows } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MortgageAnalysisResult } from "@/types/mortgage";

interface AnalysisRecord {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  result: MortgageAnalysisResult;
  created_at: string;
}

export interface ComparisonItem {
  result: MortgageAnalysisResult;
  fileName: string;
  date: string;
}

interface AnalysisHistoryProps {
  onLoad: (result: MortgageAnalysisResult, fileName: string) => void;
  onCompare?: (items: [ComparisonItem, ComparisonItem]) => void;
}

export function AnalysisHistory({ onLoad, onCompare }: AnalysisHistoryProps) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({ title: "Error", description: "No se pudieron cargar los análisis", variant: "destructive" });
    } else {
      setRecords((data as unknown as AnalysisRecord[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchRecords();
      setCompareMode(false);
      setSelected(new Set());
    }
  }, [open]);

  const handleLoad = (record: AnalysisRecord) => {
    if (compareMode) return;
    onLoad(record.result, record.file_name || "análisis guardado");
    setOpen(false);
    toast({ title: "Análisis cargado" });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast({ title: "Análisis eliminado" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const handleCompare = () => {
    if (selected.size !== 2 || !onCompare) return;
    const ids = Array.from(selected);
    const items = ids.map((id) => {
      const r = records.find((rec) => rec.id === id)!;
      return {
        result: r.result,
        fileName: r.file_name || "Sin nombre",
        date: formatDate(r.created_at),
      } as ComparisonItem;
    });
    onCompare(items as [ComparisonItem, ComparisonItem]);
    setOpen(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <History className="h-4 w-4" />
          Historial
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Análisis guardados
          </SheetTitle>
        </SheetHeader>

        {/* Compare toolbar */}
        <div className="flex items-center justify-between mt-4 mb-2 gap-2">
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setCompareMode(!compareMode);
              setSelected(new Set());
            }}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {compareMode ? "Cancelar" : "Comparar"}
          </Button>
          {compareMode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size}/2 seleccionados</span>
              <Button size="sm" disabled={selected.size !== 2} onClick={handleCompare}>
                Comparar
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-160px)]">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay análisis guardados</p>
          ) : (
            <div className="space-y-2 pr-4">
              {records.map((record) => {
                const ext = record.result?.extraction;
                const tipo = ext?.tipo_hipoteca;
                const isSelected = selected.has(record.id);
                return (
                  <button
                    key={record.id}
                    onClick={() => compareMode ? toggleSelect(record.id) : handleLoad(record)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors group",
                      compareMode && isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {compareMode ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(record.id)}
                            className="shrink-0"
                          />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{record.file_name || "Sin nombre"}</span>
                      </div>
                      {!compareMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => handleDelete(record.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {tipo && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tipo === "fija" ? "Fija" : tipo === "variable" ? "Variable" : "Mixta"}
                        </Badge>
                      )}
                      {ext?.tin_bonificado?.value != null && (
                        <span className="text-xs text-muted-foreground">TIN {ext.tin_bonificado.value}%</span>
                      )}
                      {ext?.cuota_final?.value != null && (
                        <span className="text-xs text-muted-foreground">Cuota {ext.cuota_final.value}€</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(record.created_at)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
