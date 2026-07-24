import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <AuthForm mode="signup" />
        </section>
      </main>
      <Footer />
    </>
  );
}
