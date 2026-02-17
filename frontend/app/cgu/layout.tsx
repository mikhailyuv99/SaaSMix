import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Conditions générales d'utilisation du site et des services Siberia Mix (mix vocal en ligne, mastering).",
};

export default function CGULayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
