/** Definition table for product specifications and packaging details. */
export default function ProductSpecifications({ rows, caption }) {
  const entries = Object.entries(rows).filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!entries.length) return <p className="text-sm text-muted">No details have been added yet.</p>;
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <tbody>
          {entries.map(([label, value], index) => (
            <tr key={label} className={index % 2 ? 'bg-white' : 'bg-surface/70'}>
              <th scope="row" className="w-2/5 px-4 py-2.5 text-left align-top font-semibold text-muted">{label}</th>
              <td className="px-4 py-2.5 text-ink">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
