import { GuardiaRol } from "@/features/sesion/guardia-rol";
import { MarcoSesion } from "@/features/sesion/marco-sesion";

export default function LayoutComerciante({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuardiaRol roles={["comerciante"]}>
      <MarcoSesion>{children}</MarcoSesion>
    </GuardiaRol>
  );
}
