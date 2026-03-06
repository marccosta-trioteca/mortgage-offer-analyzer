import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileText, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import type { MortgageAnalysisResult } from "@/types/mortgage";

interface AnalysisRecord {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  result: MortgageAnalysisResult;
  created_at: string;
}

interface AnalysisHistoryProps {
  onLoad: (result: MortgageAnalysisResult, fileName: string) => void;
}

export function AnalysisHistory({ onLoad }: AnalysisHistoryProps) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (open) fetchRecords();
  }, [open]);

  const handleLoad = (record: AnalysisRecord) => {
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
      toast({ title: "Análisis eliminado" });
    }
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
        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay análisis guardados</p>
          ) : (
            <div className="space-y-2 pr-4">
              {records.map((record) => {
                const ext = record.result?.extraction;
                const tipo = ext?.tipo_hipoteca;
                return (
                  <button
                    key={record.id}
                    onClick={() => handleLoad(record)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{record.file_name || "Sin nombre"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => handleDelete(record.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
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
