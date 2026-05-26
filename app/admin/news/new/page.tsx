import { NewsForm } from "@/features/news/components";

export default function AdminNewsNewPage() {
  return (
    <div className="py-2">
      <NewsForm key="create" mode="create" />
    </div>
  );
}
