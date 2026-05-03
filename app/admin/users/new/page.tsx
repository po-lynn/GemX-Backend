import { UserForm } from "@/features/users/components";

export default function AdminUsersNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New User</h1>
        <p className="mt-0.5 text-sm text-slate-500">Create a user with email and password</p>
      </div>
      <UserForm key="create" mode="create" />
    </div>
  );
}
