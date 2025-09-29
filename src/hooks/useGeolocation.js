import { useCallback, useState } from 'react';

export function useGeolocation(defaultOptions = {}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(null);

  const locate = useCallback((overrideOptions = {}) => {
    if (!('geolocation' in navigator)) {
      setError(new Error('Geolocation is not supported in this browser.'));
      setStatus('unsupported');
      return Promise.reject(new Error('Geolocation unsupported'));
    }
    setStatus('requesting');
    setError(null);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const coords = {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy
          };
          setPosition(coords);
          setStatus('resolved');
          resolve(coords);
        },
        (err) => {
          const message = err?.message || 'Unable to fetch your location.';
          const wrapped = new Error(message);
          wrapped.code = err?.code;
          setError(wrapped);
          setStatus('error');
          reject(wrapped);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...defaultOptions, ...overrideOptions }
      );
    });
  }, [defaultOptions]);

  return {
    status,
    error,
    position,
    locate
  };
}
