import { NewLaboratoryFormWrapper } from "./NewLaboratoryFormWrapper";

export default function AdminLaboratoryNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New Laboratory</h1>
        <p className="mt-0.5 text-sm text-slate-500">Add a certification laboratory (e.g. GIA, AGS)</p>
      </div>
      <NewLaboratoryFormWrapper />
    </div>
  );
}
