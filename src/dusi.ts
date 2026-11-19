import './dusi.css';

const dialog = document.querySelector<HTMLDialogElement>('#dusi-dialog')!;
const opener = document.querySelector<HTMLButtonElement>('#open-dusi')!;

function open(): void {
  if (!dialog.open) dialog.showModal();
}

opener.addEventListener('click', open);
dialog.querySelector('#close-dusi')!.addEventListener('click', () => dialog.close());
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') event.stopPropagation();
});
dialog.addEventListener('close', () => {
  if (location.hash === '#dusi') history.replaceState(null, '', location.pathname + location.search);
  opener.focus({ preventScroll: true });
});
window.addEventListener('hashchange', () => { if (location.hash === '#dusi') open(); });
if (location.hash === '#dusi') open();
