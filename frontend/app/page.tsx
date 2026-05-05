import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TrustedBy } from "@/components/TrustedBy";
import { LiveDemo } from "@/components/LiveDemo";
import {
  Steps,
  FeaturesGrid,
  MarketingTestimonials,
  FAQ,
  FinalCTA,
} from "@/components/HomeBelow";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <main>
      <div className="relative flex min-h-screen flex-col">
        <Nav />
        <Hero />
        <div className="mt-auto">
          <TrustedBy />
        </div>
      </div>
      <LiveDemo />
      <Steps />
      <FeaturesGrid />
      <MarketingTestimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
