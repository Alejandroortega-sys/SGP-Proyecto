import { GuardiaRol } from "@/features/sesion/guardia-rol";
import { MarcoSesion } from "@/features/sesion/marco-sesion";

export default function LayoutOrganizador({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuardiaRol roles={["organizador"]}>
      <MarcoSesion>{children}</MarcoSesion>
    </GuardiaRol>
  );
}
