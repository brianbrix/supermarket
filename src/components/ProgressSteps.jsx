export default function ProgressSteps({ current }) {
  const steps = [
    { id: 1, label: 'Details' },
    { id: 2, label: 'Payment' },
    { id: 3, label: 'Confirm' }
  ];
  return (
    <ol className="steps" aria-label="Checkout progress">
      {steps.map(s => {
        const status = s.id === current ? 'current' : (s.id < current ? 'done' : 'upcoming');
        return (
          <li key={s.id} className={status}>
            <span className="circle">{s.id}</span>
            <span className="label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}