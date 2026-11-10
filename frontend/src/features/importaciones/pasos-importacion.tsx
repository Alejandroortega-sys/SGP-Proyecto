const PASOS = [
  { numero: 1, titulo: "Cargar" },
  { numero: 2, titulo: "Previsualizar" },
  { numero: 3, titulo: "Confirmar" },
  { numero: 4, titulo: "Reporte" },
] as const;

/** Indicador accesible del avance de la importación. */
export function PasosImportacion({
  pasoActual,
}: {
  pasoActual: 1 | 2 | 3 | 4;
}) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PASOS.map((paso) => {
        const completado = paso.numero < pasoActual;
        const actual = paso.numero === pasoActual;

        return (
          <li
            key={paso.numero}
            aria-current={actual ? "step" : undefined}
            className={[
              "rounded-lg border px-3 py-2 text-sm",
              actual
                ? "border-primario bg-primario-suave text-primario"
                : completado
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-borde bg-superficie text-tenue",
            ].join(" ")}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">
              Paso {paso.numero}
            </span>
            <span className="font-semibold">{paso.titulo}</span>
          </li>
        );
      })}
    </ol>
  );
}
