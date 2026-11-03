// Markdown mínimo: "## " vira título, "**x**" vira negrito, quebras de linha preservadas.
export default function TermsBody({ md }) {
  return md.split(/\n\n+/).map((block, i) => {
    if (block.startsWith('## ')) return <h2 key={i} style={{ marginTop: 18 }}>{block.slice(3)}</h2>;
    const parts = block.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={i} style={{ whiteSpace: 'pre-line' }}>
        {parts.map((p, k) => (k % 2 ? <strong key={k}>{p}</strong> : p))}
      </p>
    );
  });
}
