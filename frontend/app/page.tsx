import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TrustedBy } from "@/components/TrustedBy";
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
      <Footer />
    </main>
  );
}
