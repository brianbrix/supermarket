// Simple front-end service abstraction for future backend integration.
// In a real application, these would call HTTP endpoints.

export function generateOrderRef() {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  return `ORD-${ymd}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

export function initiatePayment({ method, amount }) {
  // Simulate async mobile money payment initiation (e.g. STK push)
  return new Promise(resolve => {
    setTimeout(() => {
      const refPrefix = method === 'mpesa' ? 'MP' : 'AT';
      resolve({ success: true, paymentRef: refPrefix + Math.random().toString(36).slice(2,8).toUpperCase() });
    }, 1200);
  });
}

export function sendEmailMock(order) {
  // placeholder for email sending
  return new Promise(resolve => setTimeout(() => resolve({ sent: true }), 400));
}
