import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import PresetMoodboards from "@/components/PresetMoodboards";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <PresetMoodboards />
      </main>
      <Footer />
    </>
  );
}
