import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TrustedBy } from "@/components/TrustedBy";
import { WhyChoose } from "@/components/WhyChoose";
import { Testimonial } from "@/components/Testimonial";
import { Elevating } from "@/components/Elevating";
import { Process } from "@/components/Process";
import { Guidelines } from "@/components/Guidelines";
import { PowerDetector } from "@/components/PowerDetector";
import { SocialProof } from "@/components/SocialProof";
import { Languages } from "@/components/Languages";
import { Footer } from "@/components/Footer";
import { AuroraSpots } from "@/components/AuroraSpots";

export default function HomePage() {
  return (
    <main>
      {/* Above-the-fold block — Nav + Hero + TrustedBy fill exactly one
          viewport. The flex column lets Hero grow naturally; TrustedBy is
          pinned to the bottom via mt-auto so the marquee always reads as
          the page's "what comes after" cue without scrolling. */}
      <div className="relative flex min-h-screen flex-col">
        <Nav />
        <Hero />
        <div className="mt-auto">
          <TrustedBy />
        </div>
      </div>

      {/* Everything below the fold shares one drifting aurora field —
          circular blooms scattered across the full vertical span, painting
          the same color language under each section. */}
      <div className="relative overflow-hidden">
        <AuroraSpots />
        <div className="relative z-10">
          <WhyChoose />
          <Testimonial
            quote="As the CEO of a BlendVest tech, maintaining content integrity is crucial for our brand. heynotai's AI Detector has become an invaluable part of our workflow."
            name="Luke Shipley"
            role="Co-Founder/CEO, BlendVest"
          />
          <Elevating />
          <Process />
          <Testimonial
            quote="Its accuracy and speed allow us to confidently publish original, human-written content. It's a game-changer for anyone serious about quality."
            name="Dr. Maria Oswald"
            role="Co-Founder/CEO, EduMastery"
          />
          <Guidelines />
          <PowerDetector />
          <Testimonial
            quote="In the publishing industry, authenticity is everything. heynotai's AI Detector gives us the confidence to evaluate manuscripts and articles with unparalleled precision."
            name="Anderson Nguyen"
            role="CEO, Authentic Reads"
            showNav
          />
          <SocialProof />
          <Testimonial
            quote="Our agency produces thousands of pieces of content monthly, and ensuring originality across the board was a challenge — until we found heynotai's AI Detector."
            name="Liam O'Connor"
            role="Co-Founder, AdSphere"
          />
          <Languages />
        </div>
      </div>

      <Footer />
    </main>
  );
}
