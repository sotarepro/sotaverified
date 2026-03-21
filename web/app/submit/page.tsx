import SubmitPaperForm from "@/components/SubmitPaperForm";

export const metadata = {
  title: "Submit a Paper — SOTAVerified",
};

export default function SubmitPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Submit a Paper</h1>
      <p className="text-gray-500 text-sm mb-8">
        Add a paper from arXiv to the tracker. We&apos;ll pull the metadata automatically.
        If the paper already exists, you&apos;ll be redirected to its page.
      </p>

      <SubmitPaperForm />
    </div>
  );
}
