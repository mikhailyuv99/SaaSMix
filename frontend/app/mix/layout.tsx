export const metadata = {
  title: { absolute: true, default: "SIBERIA MIX | MIX VOCAL EN LIGNE" },
  description: "Uploadez vos stems et votre instrumental, choisissez vos réglages (de-esser, réverb…), lancez le mix et téléchargez votre mix final.",
};

export default function MixLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
