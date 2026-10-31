import { GuardiaRol } from "@/features/sesion/guardia-rol";
import { MarcoSesion } from "@/features/sesion/marco-sesion";

export default function LayoutSesion({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuardiaRol roles={["comerciante", "organizador", "gestor"]}>
      <MarcoSesion>{children}</MarcoSesion>
    </GuardiaRol>
  );
}
