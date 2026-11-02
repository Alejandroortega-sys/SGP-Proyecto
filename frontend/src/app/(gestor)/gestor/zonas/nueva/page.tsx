import type { Metadata } from "next";
import { EditorZona } from "@/features/zonas/editor-zona";

export const metadata: Metadata = {
  title: "Nueva zona",
};

export default function PaginaNuevaZona() {
  return <EditorZona />;
}
