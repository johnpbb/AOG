import Link from "next/link";
import { Header } from "@/components/header";
import { ArrowRight, Calendar, MapPin, Users, Building2, Globe, Star } from "lucide-react";

export default function HomePage() {
  const stats = [
    { label: "Expected Attendees", value: "21,000+", icon: Users },
    { label: "Participating Churches", value: "415+", icon: Building2 },
    { label: "Years of Faith", value: "100", icon: Star },
    { label: "Countries Represented", value: "10+", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-sm font-medium mb-6">
              <Calendar className="h-4 w-4" />
              <span>Registration Opens April 15, 2026</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
              AOG Fiji 100th Anniversary Celebration
            </h1>
            <p className="mt-6 text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto text-pretty">
              Join us in celebrating 100 years of the Assemblies of God in Fiji.
              A historic gathering of faith, unity, and praise.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-foreground px-6 py-3 text-base font-medium text-primary transition-colors hover:bg-primary-foreground/90"
              >
                Register Now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#details"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-primary-foreground/20 px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
              >
                Event Details
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary mb-4">
                  <stat.icon className="h-6 w-6 text-foreground" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Details Section */}
      <section id="details" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Event Information
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about the AOG Fiji 100th Anniversary Celebration
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <Calendar className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">Date & Time</h3>
              <p className="mt-2 text-muted-foreground">
                Event dates to be announced. Registration opens April 15, 2026.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <MapPin className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">Venues</h3>
              <p className="mt-2 text-muted-foreground">
                Multiple venues across Fiji to accommodate all attendees with live streaming available.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <Users className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">Who Can Attend</h3>
              <p className="mt-2 text-muted-foreground">
                Open to all churches, missionaries, partners, and individual believers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Categories */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Registration Categories
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Choose the category that best represents your registration type
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { name: "Church Registration", desc: "For all church sizes" },
              { name: "Church Plant", desc: "New church plants" },
              { name: "World Fijian Congress", desc: "Overseas network" },
              { name: "WFC Partners", desc: "Missionaries & Partners" },
              { name: "Individual", desc: "Personal registration" },
            ].map((cat) => (
              <div
                key={cat.name}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <h3 className="font-medium text-foreground">{cat.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cat.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start Registration
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                100
              </div>
              <span className="text-sm text-muted-foreground">
                AOG Fiji 100th Anniversary
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/register" className="hover:text-foreground transition-colors">
                Register
              </Link>
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Admin
              </Link>
              <span>Powered by VaizeePay</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
