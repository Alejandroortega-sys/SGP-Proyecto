import { combinarClases } from "@/lib/clases";

/** Bloque base de carga. Ajusta tamaño con className (p. ej. `h-3 w-24`). */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={combinarClases("animate-pulse rounded-md bg-interaccion-fuerte", className)}
    />
  );
}

/** Varias líneas de texto en carga; la última queda incompleta. */
export function EsqueletoTexto({
  lineas = 3,
  className,
}: {
  lineas?: number;
  className?: string;
}) {
  return (
    <div className={combinarClases("space-y-2", className)}>
      {Array.from({ length: lineas }, (_, indice) => (
        <Esqueleto
          key={indice}
          className={indice === lineas - 1 ? "h-3 w-2/3" : "h-3 w-full"}
        />
      ))}
    </div>
  );
}

/** Avatar o icono circular en carga. */
export function EsqueletoCircular({ className }: { className?: string }) {
  return <Esqueleto className={combinarClases("size-10 rounded-full", className)} />;
}
