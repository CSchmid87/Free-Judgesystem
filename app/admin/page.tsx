export default function AdminPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Admin Dashboard</h1>
      <p>You are authenticated as admin.</p>
      <p>
        <a href="/admin/create">Create new event</a>
      </p>
    </div>
  );
}
