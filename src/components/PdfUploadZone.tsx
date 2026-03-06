import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

interface PdfUploadZoneProps {
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  isLoading: boolean;
  fileName?: string;
  multiple?: boolean;
  files?: File[];
  onRemoveFile?: (index: number) => void;
}

export function PdfUploadZone({
  onFileSelect,
  onFilesSelect,
  isLoading,
  fileName,
  multiple = false,
  files = [],
  onRemoveFile,
}: PdfUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_TYPES.includes(f.type)
      );
      if (multiple && onFilesSelect && droppedFiles.length > 0) {
        onFilesSelect(droppedFiles);
      } else if (droppedFiles[0]) {
        onFileSelect(droppedFiles[0]);
      }
    },
    [onFileSelect, onFilesSelect, multiple]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []);
      if (multiple && onFilesSelect && selected.length > 0) {
        onFilesSelect(selected);
      } else if (selected[0]) {
        onFileSelect(selected[0]);
      }
      e.target.value = "";
    },
    [onFileSelect, onFilesSelect, multiple]
  );

  const hasFiles = multiple ? files.length > 0 : !!fileName;

  return (
    <div className="space-y-3">
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
          hasFiles && "border-primary/30 bg-primary/5 p-4"
        )}
      >
        {hasFiles && !multiple ? (
          <>
            <FileText className="h-12 w-12 text-primary" />
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">Archivo cargado correctamente</p>
          </>
        ) : !hasFiles ? (
          <>
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {multiple
                  ? "Arrastra tus PDFs, PNGs o JPGs aquí"
                  : "Arrastra tu PDF, PNG o JPG aquí"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {multiple
                  ? "o haz clic para seleccionar varios archivos (máx. 20MB c/u)"
                  : "o haz clic para seleccionar (máx. 20MB)"}
              </p>
            </div>
          </>
        ) : null}

        {/* Multi-file list */}
        {multiple && files.length > 0 && (
          <div className="w-full space-y-1.5">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
                {onRemoveFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => onRemoveFile(i)}
                    disabled={isLoading}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={handleFileInput}
            disabled={isLoading}
            multiple={multiple}
          />
          <Button variant="outline" size="sm" asChild disabled={isLoading}>
            <span>
              {hasFiles
                ? multiple
                  ? "Añadir más archivos"
                  : "Cambiar archivo"
                : "Seleccionar archivo"}
            </span>
          </Button>
        </label>
      </div>
    </div>
  );
}
