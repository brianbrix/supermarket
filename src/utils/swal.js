import Swal from 'sweetalert2';

export async function confirm(options) {
  // options: { title, text, icon, confirmButtonText, cancelButtonText }
  const res = await Swal.fire({
    title: options.title ?? 'Are you sure?',
    text: options.text ?? '',
    icon: options.icon ?? 'warning',
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText ?? 'Yes',
    cancelButtonText: options.cancelButtonText ?? 'Cancel',
    reverseButtons: true
  });
  return res.isConfirmed;
}

export function alert(options) {
  Swal.fire({
    title: options.title ?? '',
    text: options.text ?? '',
    icon: options.icon ?? 'info',
    confirmButtonText: options.confirmButtonText ?? 'OK'
  });
}

export function success(text, title = 'Success') {
  return Swal.fire({
    title: title,
    text: text ?? '',
    icon: 'success',
    confirmButtonText: 'OK'
  });
}
