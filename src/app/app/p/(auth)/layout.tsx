export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e0e0e',
        padding: '20px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
