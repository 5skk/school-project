const uiSound = (() => {
  const preferences = {
    enabled: localStorage.getItem('soundEnabled') !== 'false',
    type: localStorage.getItem('clickSound') || 'default'
  };

  const soundProfiles = {
    default: { frequency: 520, duration: 0.08, volume: 0.045, wave: 'sine' },
    soft: { frequency: 680, duration: 0.06, volume: 0.032, wave: 'triangle' },
    muted: { frequency: 220, duration: 0.11, volume: 0.05, wave: 'sine' }
  };

  function getAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
  }

  function playTone(profileName = preferences.type) {
    if (!preferences.enabled) {
      return;
    }

    const profile = soundProfiles[profileName] || soundProfiles.default;
    const context = getAudioContext();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = profile.wave;
    oscillator.frequency.value = profile.frequency;
    filter.type = 'lowpass';
    filter.frequency.value = profileName === 'muted' ? 560 : 1800;

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(profile.volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + profile.duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + profile.duration + 0.02);
  }

  function playClick(profileName) {
    playTone(profileName);
  }

  function setEnabled(enabled) {
    preferences.enabled = Boolean(enabled);
    localStorage.setItem('soundEnabled', String(preferences.enabled));
  }

  function setType(type) {
    preferences.type = soundProfiles[type] ? type : 'default';
    localStorage.setItem('clickSound', preferences.type);
  }

  function getPreferences() {
    return { ...preferences };
  }

  return {
    getPreferences,
    playClick,
    setEnabled,
    setType
  };
})();

window.uiSound = uiSound;
