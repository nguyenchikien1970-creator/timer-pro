/* =============================================
   TIMER PRO — Application Logic
   ============================================= */

(() => {
    'use strict';

    // =============================================
    // CONSTANTS
    // =============================================
    const RING_CIRCUMFERENCE = 2 * Math.PI * 126; // ~791.68
    const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    // =============================================
    // AUDIO CONTEXT (Web Audio API for alarm)
    // =============================================
    let audioCtx = null;
    let soundEnabled = true;

    function getAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx;
    }

    function playAlarmSound() {
        if (!soundEnabled) return;
        try {
            const ctx = getAudioCtx();
            const notes = [880, 1100, 880, 1100, 880];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.2);
                osc.stop(ctx.currentTime + i * 0.2 + 0.2);
            });
        } catch (e) {
            // Audio not supported
        }
    }

    function playTickSound() {
        if (!soundEnabled) return;
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 600;
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.06);
        } catch (e) { }
    }

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================
    function pad(n, len = 2) {
        return String(n).padStart(len, '0');
    }

    function formatTime(ms, showMs = false) {
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const msPart = Math.floor((ms % 1000) / 10);
        return { h: pad(h), m: pad(m), s: pad(s), ms: pad(msPart) };
    }

    function setRingProgress(el, fraction) {
        const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
        el.style.strokeDashoffset = offset;
    }

    function $(id) {
        return document.getElementById(id);
    }

    // =============================================
    // MODE SWITCHING
    // =============================================
    let currentMode = 'stopwatch';
    const tabs = document.querySelectorAll('.mode-tab');
    const panels = document.querySelectorAll('.timer-panel');
    const indicator = $('tab-indicator');

    function switchMode(mode) {
        currentMode = mode;
        tabs.forEach(tab => {
            const isActive = tab.dataset.mode === mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });
        panels.forEach(p => {
            p.classList.toggle('active', p.id === `panel-${mode}`);
        });

        const idx = ['stopwatch', 'countdown', 'pomodoro'].indexOf(mode);
        indicator.style.transform = `translateX(${idx * 100}%)`;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // =============================================
    // SOUND & FULLSCREEN TOGGLES
    // =============================================
    const btnSound = $('btn-sound-toggle');
    btnSound.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        btnSound.classList.toggle('active', soundEnabled);
        if (soundEnabled) playTickSound();
    });
    btnSound.classList.add('active');

    const btnFullscreen = $('btn-fullscreen');
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    });

    // =============================================
    // STOPWATCH
    // =============================================
    const sw = {
        running: false,
        startTime: 0,
        elapsed: 0,
        animFrame: null,
        laps: [],
        lastLapTime: 0,
    };

    const swDisplay = {
        hours: $('sw-hours'),
        minutes: $('sw-minutes'),
        seconds: $('sw-seconds'),
        ms: $('sw-ms'),
        ring: $('stopwatch-ring'),
        startBtn: $('sw-start'),
        resetBtn: $('sw-reset'),
        lapBtn: $('sw-lap'),
        lapsList: $('laps-list'),
        lapsHeader: $('laps-header'),
    };

    function updateStopwatchDisplay() {
        const now = performance.now();
        const total = sw.elapsed + (sw.running ? now - sw.startTime : 0);
        const t = formatTime(total, true);

        swDisplay.hours.textContent = t.h;
        swDisplay.minutes.textContent = t.m;
        swDisplay.seconds.textContent = t.s;
        swDisplay.ms.textContent = `.${t.ms}`;

        // Ring: cycle every 60s
        const secFraction = (total % 60000) / 60000;
        setRingProgress(swDisplay.ring, secFraction);

        if (sw.running) {
            sw.animFrame = requestAnimationFrame(updateStopwatchDisplay);
        }
    }

    function swStart() {
        if (sw.running) {
            // Pause
            sw.elapsed += performance.now() - sw.startTime;
            sw.running = false;
            cancelAnimationFrame(sw.animFrame);
            swDisplay.startBtn.innerHTML = `${PLAY_ICON} Resume`;
            swDisplay.startBtn.classList.remove('running');
            swDisplay.lapBtn.disabled = true;
            $('panel-stopwatch').classList.remove('running');
            $('panel-stopwatch').classList.add('paused');
        } else {
            // Start
            sw.startTime = performance.now();
            sw.running = true;
            swDisplay.startBtn.innerHTML = `${PAUSE_ICON} Pause`;
            swDisplay.startBtn.classList.add('running');
            swDisplay.resetBtn.disabled = false;
            swDisplay.lapBtn.disabled = false;
            $('panel-stopwatch').classList.add('running');
            $('panel-stopwatch').classList.remove('paused');
            updateStopwatchDisplay();
        }
    }

    function swReset() {
        sw.running = false;
        sw.elapsed = 0;
        sw.laps = [];
        sw.lastLapTime = 0;
        cancelAnimationFrame(sw.animFrame);
        swDisplay.startBtn.innerHTML = `${PLAY_ICON} Start`;
        swDisplay.startBtn.classList.remove('running');
        swDisplay.resetBtn.disabled = true;
        swDisplay.lapBtn.disabled = true;
        swDisplay.hours.textContent = '00';
        swDisplay.minutes.textContent = '00';
        swDisplay.seconds.textContent = '00';
        swDisplay.ms.textContent = '.00';
        setRingProgress(swDisplay.ring, 0);
        swDisplay.lapsList.innerHTML = '';
        swDisplay.lapsHeader.style.display = 'none';
        $('panel-stopwatch').classList.remove('running', 'paused');
    }

    function swLap() {
        if (!sw.running) return;
        const total = sw.elapsed + performance.now() - sw.startTime;
        const lapTime = total - sw.lastLapTime;
        sw.lastLapTime = total;
        sw.laps.unshift({ lapTime, total });
        renderLaps();
        playTickSound();
    }

    function renderLaps() {
        if (sw.laps.length === 0) {
            swDisplay.lapsHeader.style.display = 'none';
            swDisplay.lapsList.innerHTML = '';
            return;
        }
        swDisplay.lapsHeader.style.display = 'grid';

        // Find best and worst
        let bestIdx = 0, worstIdx = 0;
        if (sw.laps.length > 1) {
            sw.laps.forEach((lap, i) => {
                if (lap.lapTime < sw.laps[bestIdx].lapTime) bestIdx = i;
                if (lap.lapTime > sw.laps[worstIdx].lapTime) worstIdx = i;
            });
        }

        swDisplay.lapsList.innerHTML = sw.laps.map((lap, i) => {
            const num = sw.laps.length - i;
            const lt = formatTime(lap.lapTime, true);
            const tt = formatTime(lap.total, true);
            let cls = '';
            if (sw.laps.length > 1) {
                if (i === bestIdx) cls = 'best';
                else if (i === worstIdx) cls = 'worst';
            }
            return `<div class="lap-item ${cls}">
                <span class="lap-num">#${pad(num)}</span>
                <span class="lap-time">${lt.m}:${lt.s}.${lt.ms}</span>
                <span class="lap-total">${tt.h}:${tt.m}:${tt.s}</span>
            </div>`;
        }).join('');
    }

    swDisplay.startBtn.addEventListener('click', swStart);
    swDisplay.resetBtn.addEventListener('click', swReset);
    swDisplay.lapBtn.addEventListener('click', swLap);

    // =============================================
    // COUNTDOWN
    // =============================================
    const cd = {
        running: false,
        totalMs: 300000, // 5 min default
        remainingMs: 300000,
        startTime: 0,
        startRemaining: 0,
        interval: null,
    };

    const cdDisplay = {
        hours: $('cd-hours'),
        minutes: $('cd-minutes'),
        seconds: $('cd-seconds'),
        label: $('cd-label'),
        ring: $('countdown-ring'),
        startBtn: $('cd-start'),
        resetBtn: $('cd-reset'),
        addBtn: $('cd-add-time'),
        setup: $('countdown-setup'),
        hoursInput: $('cd-hours-input'),
        minutesInput: $('cd-minutes-input'),
        secondsInput: $('cd-seconds-input'),
        ringArea: $('countdown-ring-area'),
    };

    function cdUpdateInputs() {
        const totalSec = Math.round(cd.totalMs / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        cdDisplay.hoursInput.value = h;
        cdDisplay.minutesInput.value = m;
        cdDisplay.secondsInput.value = s;
    }

    function cdReadInputs() {
        const h = parseInt(cdDisplay.hoursInput.value) || 0;
        const m = parseInt(cdDisplay.minutesInput.value) || 0;
        const s = parseInt(cdDisplay.secondsInput.value) || 0;
        cd.totalMs = (h * 3600 + m * 60 + s) * 1000;
        cd.remainingMs = cd.totalMs;
    }

    function cdUpdateDisplay() {
        const t = formatTime(Math.max(0, cd.remainingMs));
        cdDisplay.hours.textContent = t.h;
        cdDisplay.minutes.textContent = t.m;
        cdDisplay.seconds.textContent = t.s;

        const fraction = cd.totalMs > 0 ? cd.remainingMs / cd.totalMs : 0;
        setRingProgress(cdDisplay.ring, fraction);

        // Finishing animation when < 10s
        const panel = $('panel-countdown');
        if (cd.running && cd.remainingMs <= 10000 && cd.remainingMs > 0) {
            panel.classList.add('countdown-finishing');
        } else {
            panel.classList.remove('countdown-finishing');
        }
    }

    function cdTick() {
        if (!cd.running) return;
        const now = performance.now();
        cd.remainingMs = cd.startRemaining - (now - cd.startTime);

        if (cd.remainingMs <= 0) {
            cd.remainingMs = 0;
            cd.running = false;
            clearInterval(cd.interval);
            cdUpdateDisplay();
            cdDisplay.startBtn.innerHTML = `${PLAY_ICON} Start`;
            cdDisplay.startBtn.classList.remove('running');
            cdDisplay.label.textContent = 'Finished!';
            $('panel-countdown').classList.remove('running', 'countdown-finishing');

            // Show alarm
            showAlarm('Time\'s Up!', 'Your countdown has finished.');
            return;
        }

        cdUpdateDisplay();
    }

    function cdStart() {
        if (cd.running) {
            // Pause
            cd.remainingMs = cd.startRemaining - (performance.now() - cd.startTime);
            cd.running = false;
            clearInterval(cd.interval);
            cdDisplay.startBtn.innerHTML = `${PLAY_ICON} Resume`;
            cdDisplay.startBtn.classList.remove('running');
            cdDisplay.label.textContent = 'Paused';
            $('panel-countdown').classList.remove('running');
            $('panel-countdown').classList.add('paused');
        } else {
            if (cd.remainingMs <= 0) {
                cdReadInputs();
                if (cd.totalMs <= 0) return;
            }
            if (!cd.totalMs && cd.remainingMs <= 0) {
                cdReadInputs();
            }
            cd.startTime = performance.now();
            cd.startRemaining = cd.remainingMs;
            cd.running = true;
            cd.interval = setInterval(cdTick, 50);
            cdDisplay.startBtn.innerHTML = `${PAUSE_ICON} Pause`;
            cdDisplay.startBtn.classList.add('running');
            cdDisplay.resetBtn.disabled = false;
            cdDisplay.label.textContent = 'Running';
            cdDisplay.setup.classList.add('hidden');
            $('panel-countdown').classList.add('running');
            $('panel-countdown').classList.remove('paused');
        }
    }

    function cdReset() {
        cd.running = false;
        clearInterval(cd.interval);
        cdReadInputs();
        cdDisplay.startBtn.innerHTML = `${PLAY_ICON} Start`;
        cdDisplay.startBtn.classList.remove('running');
        cdDisplay.resetBtn.disabled = true;
        cdDisplay.label.textContent = 'Ready';
        cdDisplay.setup.classList.remove('hidden');
        $('panel-countdown').classList.remove('running', 'paused', 'countdown-finishing');
        cdUpdateDisplay();
    }

    function cdAddTime() {
        cd.remainingMs += 60000;
        cd.totalMs += 60000;
        if (cd.running) {
            cd.startRemaining += 60000;
        }
        cdUpdateDisplay();
    }

    // Preset chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const secs = parseInt(chip.dataset.seconds);
            cd.totalMs = secs * 1000;
            cd.remainingMs = cd.totalMs;
            cdUpdateInputs();
            cdUpdateDisplay();
            playTickSound();
        });
    });

    // Input changes
    [cdDisplay.hoursInput, cdDisplay.minutesInput, cdDisplay.secondsInput].forEach(input => {
        input.addEventListener('change', () => {
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            cdReadInputs();
            cdUpdateDisplay();
        });
        input.addEventListener('focus', () => input.select());
    });

    cdDisplay.startBtn.addEventListener('click', cdStart);
    cdDisplay.resetBtn.addEventListener('click', cdReset);
    cdDisplay.addBtn.addEventListener('click', cdAddTime);

    // Initial display
    cdUpdateDisplay();

    // =============================================
    // POMODORO
    // =============================================
    const pomo = {
        running: false,
        focusDuration: 25,   // minutes
        shortBreak: 5,
        longBreak: 15,
        currentSession: 0,   // 0-3 (4 focus sessions)
        phase: 'focus',      // 'focus' | 'short' | 'long'
        totalMs: 25 * 60 * 1000,
        remainingMs: 25 * 60 * 1000,
        startTime: 0,
        startRemaining: 0,
        interval: null,
        totalFocusMin: 0,
        completedSessions: 0,
    };

    const pmDisplay = {
        minutes: $('pm-minutes'),
        seconds: $('pm-seconds'),
        ring: $('pomodoro-ring'),
        phaseLabel: $('pomo-phase-label'),
        sessionLabel: $('pomo-session-label'),
        startBtn: $('pm-start'),
        resetBtn: $('pm-reset'),
        skipBtn: $('pm-skip'),
        dots: document.querySelectorAll('.pomo-dot'),
        focusVal: $('pomo-focus-val'),
        shortVal: $('pomo-short-val'),
        longVal: $('pomo-long-val'),
        totalFocus: $('pomo-total-focus'),
        completed: $('pomo-completed'),
        settings: $('pomo-settings'),
    };

    function pomoGetCurrentDuration() {
        if (pomo.phase === 'focus') return pomo.focusDuration;
        if (pomo.phase === 'short') return pomo.shortBreak;
        return pomo.longBreak;
    }

    function pomoSetupPhase() {
        const dur = pomoGetCurrentDuration();
        pomo.totalMs = dur * 60 * 1000;
        pomo.remainingMs = pomo.totalMs;
        pomoUpdateDisplay();
        pomoUpdateLabels();
        pomoUpdateRingColor();
    }

    function pomoUpdateLabels() {
        if (pomo.phase === 'focus') {
            pmDisplay.phaseLabel.textContent = 'Focus Time';
            pmDisplay.sessionLabel.textContent = `Focus ${pomo.currentSession + 1}/4`;
        } else if (pomo.phase === 'short') {
            pmDisplay.phaseLabel.textContent = 'Short Break';
            pmDisplay.sessionLabel.textContent = `Break`;
        } else {
            pmDisplay.phaseLabel.textContent = 'Long Break';
            pmDisplay.sessionLabel.textContent = `Long Break`;
        }

        // Update dots
        pmDisplay.dots.forEach((dot, i) => {
            dot.classList.remove('active', 'completed');
            if (i < pomo.currentSession) {
                dot.classList.add('completed');
            }
            if (i === pomo.currentSession && pomo.phase === 'focus') {
                dot.classList.add('active');
            }
        });
    }

    function pomoUpdateRingColor() {
        const ring = pmDisplay.ring;
        if (pomo.phase === 'focus') {
            ring.classList.remove('break-phase');
        } else {
            ring.classList.add('break-phase');
        }
    }

    function pomoUpdateDisplay() {
        const t = formatTime(Math.max(0, pomo.remainingMs));
        pmDisplay.minutes.textContent = t.m;
        pmDisplay.seconds.textContent = t.s;
        const fraction = pomo.totalMs > 0 ? pomo.remainingMs / pomo.totalMs : 0;
        setRingProgress(pmDisplay.ring, fraction);
    }

    function pomoTick() {
        if (!pomo.running) return;
        const now = performance.now();
        pomo.remainingMs = pomo.startRemaining - (now - pomo.startTime);

        if (pomo.remainingMs <= 0) {
            pomo.remainingMs = 0;
            pomo.running = false;
            clearInterval(pomo.interval);
            pomoUpdateDisplay();

            if (pomo.phase === 'focus') {
                pomo.totalFocusMin += pomo.focusDuration;
                pomo.completedSessions++;
                pmDisplay.totalFocus.textContent = pomo.totalFocusMin;
                pmDisplay.completed.textContent = pomo.completedSessions;
            }

            // Transition to next phase
            pomoNextPhase();
            return;
        }

        pomoUpdateDisplay();
    }

    function pomoNextPhase() {
        if (pomo.phase === 'focus') {
            pomo.currentSession++;
            if (pomo.currentSession >= 4) {
                pomo.phase = 'long';
                showAlarm('Great Work!', 'You completed 4 focus sessions. Time for a long break!');
            } else {
                pomo.phase = 'short';
                showAlarm('Focus Complete!', 'Time for a short break.');
            }
        } else {
            if (pomo.phase === 'long') {
                pomo.currentSession = 0;
            }
            pomo.phase = 'focus';
        }

        pomoSetupPhase();
        pmDisplay.startBtn.innerHTML = `${PLAY_ICON} Start`;
        pmDisplay.startBtn.classList.remove('running');
        $('panel-pomodoro').classList.remove('running', 'paused');
        pmDisplay.settings.style.display = '';
    }

    function pomoStart() {
        if (pomo.running) {
            // Pause
            pomo.remainingMs = pomo.startRemaining - (performance.now() - pomo.startTime);
            pomo.running = false;
            clearInterval(pomo.interval);
            pmDisplay.startBtn.innerHTML = `${PLAY_ICON} Resume`;
            pmDisplay.startBtn.classList.remove('running');
            $('panel-pomodoro').classList.remove('running');
            $('panel-pomodoro').classList.add('paused');
        } else {
            pomo.startTime = performance.now();
            pomo.startRemaining = pomo.remainingMs;
            pomo.running = true;
            pomo.interval = setInterval(pomoTick, 50);
            pmDisplay.startBtn.innerHTML = `${PAUSE_ICON} Pause`;
            pmDisplay.startBtn.classList.add('running');
            pmDisplay.settings.style.display = 'none';
            $('panel-pomodoro').classList.add('running');
            $('panel-pomodoro').classList.remove('paused');
        }
    }

    function pomoReset() {
        pomo.running = false;
        clearInterval(pomo.interval);
        pomo.currentSession = 0;
        pomo.phase = 'focus';
        pomo.totalFocusMin = 0;
        pomo.completedSessions = 0;
        pmDisplay.totalFocus.textContent = '0';
        pmDisplay.completed.textContent = '0';
        pmDisplay.startBtn.innerHTML = `${PLAY_ICON} Start`;
        pmDisplay.startBtn.classList.remove('running');
        pmDisplay.settings.style.display = '';
        $('panel-pomodoro').classList.remove('running', 'paused');
        pomoSetupPhase();
    }

    function pomoSkip() {
        pomo.running = false;
        clearInterval(pomo.interval);
        if (pomo.phase === 'focus') {
            pomo.currentSession++;
            if (pomo.currentSession >= 4) {
                pomo.phase = 'long';
                pomo.currentSession = 0;
            } else {
                pomo.phase = 'short';
            }
        } else {
            if (pomo.phase === 'long') {
                pomo.currentSession = 0;
            }
            pomo.phase = 'focus';
        }
        pomoSetupPhase();
        pmDisplay.startBtn.innerHTML = `${PLAY_ICON} Start`;
        pmDisplay.startBtn.classList.remove('running');
        pmDisplay.settings.style.display = '';
        $('panel-pomodoro').classList.remove('running', 'paused');
    }

    // Pomodoro settings adjustment
    document.querySelectorAll('.adj-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (pomo.running) return;
            const target = btn.dataset.target;
            const dir = parseInt(btn.dataset.dir);

            if (target === 'focus') {
                pomo.focusDuration = Math.max(1, Math.min(120, pomo.focusDuration + dir));
                pmDisplay.focusVal.textContent = pomo.focusDuration;
            } else if (target === 'short') {
                pomo.shortBreak = Math.max(1, Math.min(30, pomo.shortBreak + dir));
                pmDisplay.shortVal.textContent = pomo.shortBreak;
            } else if (target === 'long') {
                pomo.longBreak = Math.max(1, Math.min(60, pomo.longBreak + dir));
                pmDisplay.longVal.textContent = pomo.longBreak;
            }

            if (pomo.phase === 'focus' && target === 'focus') {
                pomoSetupPhase();
            } else if (pomo.phase === 'short' && target === 'short') {
                pomoSetupPhase();
            } else if (pomo.phase === 'long' && target === 'long') {
                pomoSetupPhase();
            }

            playTickSound();
        });
    });

    pmDisplay.startBtn.addEventListener('click', pomoStart);
    pmDisplay.resetBtn.addEventListener('click', pomoReset);
    pmDisplay.skipBtn.addEventListener('click', pomoSkip);

    // Initialize pomodoro
    pomoSetupPhase();

    // =============================================
    // ALARM OVERLAY
    // =============================================
    const alarmOverlay = $('alarm-overlay');
    const alarmTitle = $('alarm-title');
    const alarmMessage = $('alarm-message');
    const alarmDismiss = $('alarm-dismiss');

    function showAlarm(title, message) {
        alarmTitle.textContent = title;
        alarmMessage.textContent = message;
        alarmOverlay.classList.add('show');
        playAlarmSound();
    }

    alarmDismiss.addEventListener('click', () => {
        alarmOverlay.classList.remove('show');
    });

    // Close alarm with Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && alarmOverlay.classList.contains('show')) {
            alarmOverlay.classList.remove('show');
        }
    });

    // =============================================
    // KEYBOARD SHORTCUTS
    // =============================================
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
            case 'Enter':
                e.preventDefault();
                if (currentMode === 'stopwatch') swStart();
                else if (currentMode === 'countdown') cdStart();
                else if (currentMode === 'pomodoro') pomoStart();
                break;
            case 'r':
            case 'R':
                if (currentMode === 'stopwatch') swReset();
                else if (currentMode === 'countdown') cdReset();
                else if (currentMode === 'pomodoro') pomoReset();
                break;
            case 'l':
            case 'L':
                if (currentMode === 'stopwatch') swLap();
                break;
            case '1':
                switchMode('stopwatch');
                break;
            case '2':
                switchMode('countdown');
                break;
            case '3':
                switchMode('pomodoro');
                break;
        }
    });

    // =============================================
    // PAGE VISIBILITY (pause update when hidden)
    // =============================================
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Refresh display when coming back
            if (currentMode === 'stopwatch' && sw.running) {
                updateStopwatchDisplay();
            }
        }
    });

    // =============================================
    // SET INITIAL RING STATE
    // =============================================
    setRingProgress(swDisplay.ring, 0);
    setRingProgress(cdDisplay.ring, 1);
    setRingProgress(pmDisplay.ring, 1);

})();
