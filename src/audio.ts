// Music is independent of WebGL/data initialization and starts only on user input.
const audio = document.querySelector<HTMLAudioElement>('#background-audio')!;
const toggle = document.querySelector<HTMLButtonElement>('#music-toggle')!;
const volume = document.querySelector<HTMLInputElement>('#music-volume')!;
const status = document.getElementById('music-status')!;
const time = document.getElementById('music-time')!;
let playPending = false;
let requestId = 0;

audio.volume = Number(volume.value) / 100;
const player = document.getElementById('music-player')!;
const guide = document.getElementById('guide-hint')!;
const playerResize = new ResizeObserver(() => {
  document.documentElement.style.setProperty('--music-player-height', `${player.offsetHeight}px`);
  document.documentElement.style.setProperty('--guide-height', `${guide.offsetHeight}px`);
});
playerResize.observe(player);
playerResize.observe(guide);

function updateButton(active: boolean): void {
  toggle.textContent = active ? 'Ⅱ 일시정지' : '▶ 재생';
  toggle.setAttribute('aria-label', active ? '배경음악 일시정지' : '배경음악 재생');
  toggle.dataset.playing = String(active);
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function updateTime(): void {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 188.839175;
  time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
}

toggle.addEventListener('click', async () => {
  const currentRequest = ++requestId;
  if (!audio.paused || playPending) {
    playPending = false;
    audio.pause();
    updateButton(false);
    status.textContent = '일시정지 · 재생을 누르면 이어집니다.';
    return;
  }

  playPending = true;
  updateButton(true);
  status.textContent = '음원을 불러오는 중입니다…';
  if (audio.error) audio.load();
  try {
    await audio.play();
  } catch (error) {
    if (currentRequest !== requestId) return;
    updateButton(false);
    status.textContent = error instanceof DOMException && error.name === 'NotAllowedError'
      ? '브라우저에서 재생이 차단되었습니다. 재생 버튼을 다시 눌러 주세요.'
      : '음원을 불러오지 못했습니다. 연결을 확인하고 다시 눌러 주세요.';
  } finally {
    if (currentRequest === requestId) playPending = false;
  }
});

audio.addEventListener('playing', () => {
  playPending = false;
  updateButton(true);
  status.textContent = '재생 중 · 곡이 끝나면 반복됩니다.';
});
audio.addEventListener('pause', () => {
  updateButton(false);
  if (!audio.error) status.textContent = '일시정지 · 재생을 누르면 이어집니다.';
});
audio.addEventListener('waiting', () => {
  if (!audio.paused) status.textContent = '음원을 불러오는 중입니다…';
});
audio.addEventListener('error', () => {
  playPending = false;
  updateButton(false);
  status.textContent = '음원을 불러오지 못했습니다. 연결을 확인하고 다시 눌러 주세요.';
});
audio.addEventListener('timeupdate', updateTime);
audio.addEventListener('loadedmetadata', updateTime);

volume.addEventListener('input', () => {
  audio.volume = Number(volume.value) / 100;
  volume.setAttribute('aria-valuetext', `${volume.value}%`);
});
