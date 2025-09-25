import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

/**
 * Hook to initiate and poll a mobile money payment.
 * Contract:
 *  - call initiate({ orderId, provider, channel, method, amount, phoneNumber })
 *  - hook will start polling (default 3s interval) until SUCCESS/FAILED or timeout
 */
export function useMobileMoneyPayment({ pollIntervalMs = 3000, timeoutMs = 120000 } = {}) {
  const [state, setState] = useState({ status: 'idle', error: null, payment: null });
  const timeoutRef = useRef();
  const pollRef = useRef();
  const startedAtRef = useRef(0);
  const orderIdRef = useRef();

  const clearTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const poll = useCallback(async () => {
    if (!orderIdRef.current) return;
    try {
      const payment = await api.payments.byOrder(orderIdRef.current);
      setState(s => ({ ...s, payment }));
      if (payment.status === 'SUCCESS' || payment.status === 'FAILED') {
        clearTimers();
        setState(s => ({ ...s, status: payment.status === 'SUCCESS' ? 'succeeded' : 'failed' }));
      }
    } catch (e) {
      // swallow intermittent errors; surface only if still idle
      setState(s => ({ ...s, error: e.message }));
    }
  }, []);

  const initiate = useCallback(async (payload) => {
    clearTimers();
    setState({ status: 'initiating', error: null, payment: null });
    try {
      const resp = await api.payments.initiateMobileMoney(payload);
      orderIdRef.current = resp.orderId;
      startedAtRef.current = Date.now();
      setState({ status: 'pending', error: null, payment: resp });
      // start polling
      pollRef.current = setInterval(poll, pollIntervalMs);
      // immediate first poll (some providers may synchronously update)
      setTimeout(poll, 1000);
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setState(s => ({ ...s, status: 'timeout' }));
      }, timeoutMs);
      return resp;
    } catch (e) {
      setState({ status: 'error', error: e.message, payment: null });
      throw e;
    }
  }, [poll, pollIntervalMs, timeoutMs]);

  useEffect(() => () => clearTimers(), []);

  const reconcile = useCallback(async ({ paymentId, orderId, provider, phoneNumber, amount }) => {
    try {
      setState(s => ({ ...s, status: 'reconciling', error: null }));
      const resp = await api.payments.reconcileManual({ paymentId, orderId, provider, phoneNumber, amount });
      // After reconciliation, if still INITIATED keep polling for any late provider callback
      orderIdRef.current = resp.orderId;
      setState(s => ({ ...s, payment: resp, status: resp.status === 'SUCCESS' ? 'succeeded' : (resp.status === 'FAILED' ? 'failed' : 'pending') }));
      if (resp.status === 'INITIATED') {
        clearTimers();
        pollRef.current = setInterval(poll, pollIntervalMs);
        setTimeout(poll, 1000);
      } else {
        clearTimers();
      }
      return resp;
    } catch (e) {
      setState(s => ({ ...s, error: e.message, status: 'error' }));
      throw e;
    }
  }, [poll, pollIntervalMs]);

  return { ...state, initiate, reconcile };
}
