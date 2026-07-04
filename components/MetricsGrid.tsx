export function MetricsGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid">
      {items.map(([k, v]) => (
        <div className="cell" key={k}>
          <div className="k">{k}</div>
          <div className="v">{v}</div>
        </div>
      ))}
    </div>
  );
}
