import { NewsForm } from "@/features/news/components";

export default function AdminNewsNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New News</h1>
        <p className="mt-0.5 text-sm text-slate-500">Create a news article with the BlockNote editor</p>
      </div>
      <NewsForm key="create" mode="create" />
    </div>
  );
}
