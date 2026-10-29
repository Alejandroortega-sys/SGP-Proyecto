import { GuardiaRol } from "@/features/sesion/guardia-rol";
import { MarcoSesion } from "@/features/sesion/marco-sesion";

export default function LayoutGestor({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuardiaRol roles={["gestor"]}>
      <MarcoSesion>{children}</MarcoSesion>
    </GuardiaRol>
  );
}
