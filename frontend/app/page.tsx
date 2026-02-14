import {
  HeroSection,
  TrustBullets,
  HowItWorks,
  VideoSection,
  BeforeAfterSection,
  FeaturesSection,
  PricingSection,
  FAQContactSection,
} from "./components/landing";

export default function HomePage() {
  return (
    <main className="min-h-screen font-heading">
      <HeroSection />
      <TrustBullets />
      <HowItWorks />
      <VideoSection />
      <BeforeAfterSection />
      <FeaturesSection />
      <PricingSection />
      <FAQContactSection />
    </main>
  );
}
