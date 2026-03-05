import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["application/pdf", "image/png"];

interface PdfUploadZoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  fileName?: string;
}

export function PdfUploadZone({ onFileSelect, isLoading, fileName }: PdfUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && ACCEPTED_TYPES.includes(file.type)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        fileName && "border-primary/30 bg-primary/5"
      )}
    >
      {fileName ? (
        <>
          <FileText className="h-12 w-12 text-primary" />
          <p className="text-sm font-medium text-foreground">{fileName}</p>
          <p className="text-xs text-muted-foreground">PDF cargado correctamente</p>
        </>
      ) : (
        <>
          <Upload className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Arrastra tu PDF o PNG aquí
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              o haz clic para seleccionar (máx. 20MB)
            </p>
          </div>
        </>
      )}
      <label>
        <input
          type="file"
          accept="application/pdf,image/png"
          className="hidden"
          onChange={handleFileInput}
          disabled={isLoading}
        />
        <Button variant="outline" size="sm" asChild disabled={isLoading}>
          <span>{fileName ? "Cambiar archivo" : "Seleccionar PDF o PNG"}</span>
        </Button>
      </label>
    </div>
  );
}
