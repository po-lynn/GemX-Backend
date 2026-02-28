export default async function AdminPage() {
  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome to GemX admin. Use the sidebar to manage products, news, articles, and users.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Quick links: Products, Categories, News, Articles, Users, Laboratory, Origin, Credit.
        </p>
      </div>
    </div>
  )
}
