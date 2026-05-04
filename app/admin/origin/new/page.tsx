import { OriginForm } from "@/features/origin/components";

export default function AdminOriginNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New Origin</h1>
        <p className="mt-0.5 text-sm text-slate-500">Add a gem origin (Myanmar or Other)</p>
      </div>
      <OriginForm key="create" mode="create" />
    </div>
  );
}
