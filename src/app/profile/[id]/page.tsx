export default async function UserProfile({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl">
        Hello, <span className="bg-orange-400 p-2 rounded-2xl">{params.id}</span>
      </h1>
    </div>
  );
}
