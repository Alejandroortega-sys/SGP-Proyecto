import { FooterPublico } from "@/features/publico/footer-publico";
import { NavbarPublica } from "@/features/publico/navbar-publica";

export default function LayoutPublico({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <NavbarPublica />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <FooterPublico />
    </div>
  );
}
