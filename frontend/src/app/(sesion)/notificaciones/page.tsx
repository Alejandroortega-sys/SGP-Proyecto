import type { Metadata } from "next";
import { BandejaNotificaciones } from "@/features/notificaciones/bandeja-notificaciones";

export const metadata: Metadata = {
  title: "Notificaciones",
};

export default function PaginaNotificaciones() {
  return <BandejaNotificaciones />;
}
