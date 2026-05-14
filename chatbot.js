/* =============================================
   TIMER PRO — Chatbot Logic + Lead Collection
   ============================================= */

(() => {
    'use strict';

    // =============================================
    // GOOGLE SHEETS WEBHOOK (Lead Storage)
    // =============================================
    // IMPORTANT: Replace with your actual Google Apps Script Web App URL
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbybx2r--kkjm8CGM5JZ4Mjdjp9u711znW9VqoMEBMcup6BFU4EOvdkBUmoyzkeFTlk/exec';
    const SESSION_ID = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const chatHistory = [];

    // =============================================
    // LEAD COLLECTION STATE
    // =============================================
    let leadFlow = {
        active: false,
        step: 0,  // 0 = not started, 1 = asked name, 2 = asked contact, 3 = asked interest
        data: { name: '', phone: '', email: '', interest: '' }
    };

    // Stored leads (also saved to localStorage)
    let collectedLeads = JSON.parse(localStorage.getItem('timerPro_leads') || '[]');

    // =============================================
    // ELEMENTS
    // =============================================
    const fab = document.getElementById('chatbot-fab');
    const chatWindow = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('chat-close-btn');
    const messagesContainer = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');

    // =============================================
    // PRODUCTIVITY TIPS
    // =============================================
    const tips = [
        "The Pomodoro Technique was invented by Francesco Cirillo in the 1980s. Work for 25 minutes, break for 5 — it trains your brain to focus in short bursts.",
        "Studies show that taking regular breaks actually increases productivity by up to 30%. Try the 52-17 rule: 52 minutes of work, 17 minutes of rest.",
        "Use the 2-Minute Rule: If a task takes less than 2 minutes, do it immediately instead of adding it to your to-do list.",
        "Time blocking is used by Elon Musk and Bill Gates. Assign specific time slots for each task and stick to them using your countdown timer.",
        "The most productive time of day for most people is between 9-11 AM. Schedule your hardest tasks during this window.",
        "After 4 Pomodoro sessions, take a longer 15-30 minute break. Your brain needs time to consolidate information.",
        "Multitasking reduces productivity by 40%. Focus on one task at a time — use the Stopwatch to track how long each task takes.",
        "The 80/20 Rule (Pareto Principle): 80% of results come from 20% of your efforts. Identify and focus on high-impact tasks.",
        "Set a countdown timer for meetings. Parkinson's Law says work expands to fill the time available — shorter time limits force efficiency.",
        "Track your deep work hours with the Stopwatch. Aim for 3-4 hours of focused, uninterrupted work each day.",
        "Batch similar tasks together. Your brain is more efficient when it stays in the same mode — use Pomodoro sessions for each batch.",
        "The Zeigarnik Effect: unfinished tasks create mental tension. Start a Pomodoro session even if you don't feel motivated — just starting helps.",
        "Hydration boosts cognitive performance by 14%. Set a countdown every 30 minutes to remind yourself to drink water.",
        "Use the stopwatch to identify how long tasks really take. Most people underestimate by 50% — better data leads to better planning.",
        "Digital detox tip: Set a 30-minute countdown, put your phone away, and focus entirely on one task. You'll be amazed at the results."
    ];

    // =============================================
    // COMMAND PATTERNS
    // =============================================
    const commands = [
        {
            patterns: [/start\s*(the\s*)?(stop\s*watch|sw)/i, /^sw\s*start/i, /run\s*stop\s*watch/i, /begin\s*stop\s*watch/i],
            action: () => {
                switchMode('stopwatch');
                const btn = document.getElementById('sw-start');
                if (btn) btn.click();
                return "Stopwatch started! Press Space to pause, or type 'stop' anytime.";
            }
        },
        {
            patterns: [/stop\s*(the\s*)?(stop\s*watch|sw)/i, /pause\s*(the\s*)?(stop\s*watch|sw)/i, /^sw\s*(stop|pause)/i],
            action: () => {
                const btn = document.getElementById('sw-start');
                if (btn && btn.classList.contains('running')) btn.click();
                return "Stopwatch paused. Type 'start stopwatch' to resume or 'reset stopwatch' to clear.";
            }
        },
        {
            patterns: [/reset\s*(the\s*)?(stop\s*watch|sw)/i, /clear\s*(the\s*)?(stop\s*watch|sw)/i],
            action: () => {
                switchMode('stopwatch');
                const btn = document.getElementById('sw-reset');
                if (btn) btn.click();
                return "Stopwatch has been reset to 00:00:00.";
            }
        },
        {
            patterns: [/lap/i, /split/i, /mark\s*lap/i],
            action: () => {
                const btn = document.getElementById('sw-lap');
                if (btn && !btn.disabled) {
                    btn.click();
                    return "Lap recorded! Check the laps list below the timer.";
                }
                return "No active stopwatch to record a lap. Start the stopwatch first.";
            }
        },
        {
            patterns: [
                /(?:set|start|begin|run)\s*(?:a\s*)?(?:count\s*down|timer|cd)\s*(?:for\s*)?(\d+)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/i,
                /count\s*down\s*(\d+)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/i,
                /(\d+)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?\s*(?:count\s*down|timer))/i
            ],
            action: (match) => {
                const value = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                let totalSeconds = 0;

                if (unit.startsWith('h')) totalSeconds = value * 3600;
                else if (unit.startsWith('m')) totalSeconds = value * 60;
                else totalSeconds = value;

                switchMode('countdown');

                const hInput = document.getElementById('cd-hours-input');
                const mInput = document.getElementById('cd-minutes-input');
                const sInput = document.getElementById('cd-seconds-input');

                if (hInput && mInput && sInput) {
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    const s = totalSeconds % 60;
                    hInput.value = h;
                    mInput.value = m;
                    sInput.value = s;
                    hInput.dispatchEvent(new Event('input'));
                    mInput.dispatchEvent(new Event('input'));
                    sInput.dispatchEvent(new Event('input'));
                }

                setTimeout(() => {
                    const btn = document.getElementById('cd-start');
                    if (btn) btn.click();
                }, 300);

                const displayTime = formatCountdownDisplay(totalSeconds);
                return `Countdown set for ${displayTime} and started! I'll notify you when time's up.`;
            }
        },
        {
            patterns: [/stop\s*(?:the\s*)?(?:count\s*down|cd|timer)/i, /pause\s*(?:the\s*)?(?:count\s*down|cd|timer)/i],
            action: () => {
                const btn = document.getElementById('cd-start');
                if (btn && btn.classList.contains('running')) btn.click();
                return "Countdown paused. Type 'resume countdown' to continue.";
            }
        },
        {
            patterns: [/reset\s*(?:the\s*)?(?:count\s*down|cd|timer)/i, /clear\s*(?:the\s*)?(?:count\s*down|cd|timer)/i],
            action: () => {
                switchMode('countdown');
                const btn = document.getElementById('cd-reset');
                if (btn) btn.click();
                return "Countdown has been reset. Set a new time to begin.";
            }
        },
        {
            patterns: [/start\s*(?:a\s*)?(?:the\s*)?pomo(?:doro)?/i, /begin\s*(?:a\s*)?pomo(?:doro)?/i, /focus\s*mode/i, /^pomo\s*start/i],
            action: () => {
                switchMode('pomodoro');
                setTimeout(() => {
                    const btn = document.getElementById('pm-start');
                    if (btn) btn.click();
                }, 200);
                return "Pomodoro Focus session started! 25 minutes of deep work. Stay focused — you've got this!";
            }
        },
        {
            patterns: [/stop\s*(?:the\s*)?pomo(?:doro)?/i, /pause\s*(?:the\s*)?pomo(?:doro)?/i],
            action: () => {
                const btn = document.getElementById('pm-start');
                if (btn && btn.classList.contains('running')) btn.click();
                return "Pomodoro paused. Take a breath, then type 'start pomodoro' to resume.";
            }
        },
        {
            patterns: [/reset\s*(?:the\s*)?pomo(?:doro)?/i],
            action: () => {
                switchMode('pomodoro');
                const btn = document.getElementById('pm-reset');
                if (btn) btn.click();
                return "Pomodoro has been reset. Ready for a new session!";
            }
        },
        {
            patterns: [/skip/i, /next\s*phase/i, /next\s*session/i],
            action: () => {
                const btn = document.getElementById('pm-skip');
                if (btn) {
                    btn.click();
                    return "Skipped to the next phase.";
                }
                return "No active Pomodoro session to skip.";
            }
        },
        {
            patterns: [/(?:go\s*to|switch|show|open)\s*(?:the\s*)?(stop\s*watch|sw)/i],
            action: () => { switchMode('stopwatch'); return "Switched to Stopwatch mode."; }
        },
        {
            patterns: [/(?:go\s*to|switch|show|open)\s*(?:the\s*)?(count\s*down|cd|timer)/i],
            action: () => { switchMode('countdown'); return "Switched to Countdown mode."; }
        },
        {
            patterns: [/(?:go\s*to|switch|show|open)\s*(?:the\s*)?(pomo(?:doro)?)/i],
            action: () => { switchMode('pomodoro'); return "Switched to Pomodoro mode."; }
        },
        // =============================================
        // LEAD COLLECTION TRIGGERS
        // =============================================
        {
            patterns: [
                /(?:contact|lien\s*he|dang\s*ky|register|sign\s*up|subscribe)/i,
                /(?:de\s*lai|leave)\s*(?:thong\s*tin|info|contact|email)/i,
                /(?:i\s*want\s*to|toi\s*muon)\s*(?:try|thu|register|dang\s*ky)/i,
                /(?:trial|free\s*trial|demo|dung\s*thu)/i,
                /(?:pricing|gia|bao\s*gia|price)/i,
                /(?:mua|buy|purchase|order|dat\s*hang)/i
            ],
            action: () => {
                startLeadFlow();
                return "Great choice! I'd love to help you get started.\n\nCould you please tell me your <strong>name</strong>?";
            }
        },
        {
            patterns: [/what\s*(?:can\s*you\s*do|are\s*your\s*(?:features|commands|capabilities))/i, /help/i, /commands/i],
            action: () => {
                return `Here's what I can do:\n\n<strong>Stopwatch:</strong> "start stopwatch", "stop", "reset stopwatch", "lap"\n\n<strong>Countdown:</strong> "set countdown 10 minutes", "countdown 30 seconds", "stop timer"\n\n<strong>Pomodoro:</strong> "start pomodoro", "pause pomodoro", "skip", "reset pomodoro"\n\n<strong>Navigation:</strong> "switch to countdown", "go to stopwatch"\n\n<strong>Tips:</strong> "give me a productivity tip"\n\n<strong>Contact:</strong> "register", "sign up", "contact" — to leave your info`;
            }
        },
        {
            patterns: [/tip/i, /productiv/i, /advice/i, /suggest/i, /how\s*to\s*(?:focus|work|be\s*productive)/i, /motivation/i],
            action: () => {
                const randomTip = tips[Math.floor(Math.random() * tips.length)];
                return `<strong>Productivity Tip:</strong>\n\n${randomTip}`;
            }
        },
        {
            patterns: [/(?:what\s*(?:is|'s)\s*)?(?:the\s*)?time/i, /current\s*time/i],
            action: () => {
                const now = new Date();
                return `Current time: <strong>${now.toLocaleTimeString()}</strong> (${now.toLocaleDateString()})`;
            }
        },
        {
            patterns: [/(?:what\s*is|explain|tell\s*me\s*about)\s*(?:the\s*)?pomo(?:doro)?(?:\s*technique)?/i],
            action: () => {
                return "The <strong>Pomodoro Technique</strong> is a time management method:\n\n1. Work for 25 minutes (1 Pomodoro)\n2. Take a 5-minute break\n3. Repeat 4 times\n4. After 4 Pomodoros, take a 15-30 min long break\n\nIt improves focus and reduces burnout. Use the Pomodoro tab to try it!";
            }
        },
        {
            patterns: [/hello|hi|hey|good\s*(morning|evening|afternoon)|sup|yo|xin\s*chao/i],
            action: () => {
                const greetings = [
                    "Hey there! Ready to be productive? What would you like to do?",
                    "Hello! I'm TimerBot, your productivity assistant. How can I help?",
                    "Hi! Need to track time, set a countdown, or start a focus session?",
                    "Hey! Let's make today count. What timer do you need?"
                ];
                return greetings[Math.floor(Math.random() * greetings.length)];
            }
        },
        {
            patterns: [/thank|thanks|thx|cheers|cam\s*on/i],
            action: () => {
                const replies = [
                    "You're welcome! Keep up the great work!",
                    "Happy to help! Let me know if you need anything else.",
                    "Anytime! Stay focused and productive!",
                    "No problem! I'm here whenever you need me."
                ];
                return replies[Math.floor(Math.random() * replies.length)];
            }
        },
        {
            patterns: [/status/i, /(?:what'?s|what\s+is)\s*(?:running|active|going\s+on)/i],
            action: () => {
                const swBtn = document.getElementById('sw-start');
                const cdBtn = document.getElementById('cd-start');
                const pmBtn = document.getElementById('pm-start');

                let status = [];
                if (swBtn && swBtn.classList.contains('running')) status.push("Stopwatch is running");
                if (cdBtn && cdBtn.classList.contains('running')) status.push("Countdown is active");
                if (pmBtn && pmBtn.classList.contains('running')) status.push("Pomodoro is in progress");

                if (status.length === 0) return "No timers are currently running. Ready to start one?";
                return `Currently active: <strong>${status.join(', ')}</strong>`;
            }
        },
        {
            patterns: [/(?:show|view|xem)\s*(?:leads?|contacts?|khach\s*hang|du\s*lieu)/i, /(?:bao\s*nhieu|how\s*many)\s*(?:leads?|contacts?|khach)/i],
            action: () => {
                if (collectedLeads.length === 0) {
                    return "No leads collected yet. When visitors type 'register' or 'contact', I'll guide them through the info collection flow.";
                }
                let summary = `<strong>Collected Leads: ${collectedLeads.length}</strong>\n\n`;
                const recent = collectedLeads.slice(-5).reverse();
                recent.forEach((lead, i) => {
                    summary += `${i + 1}. <strong>${lead.name || 'N/A'}</strong>`;
                    if (lead.email) summary += ` — ${lead.email}`;
                    if (lead.phone) summary += ` — ${lead.phone}`;
                    summary += `\n`;
                });
                if (collectedLeads.length > 5) {
                    summary += `\n...and ${collectedLeads.length - 5} more`;
                }
                return summary;
            }
        }
    ];

    // =============================================
    // LEAD COLLECTION FLOW
    // =============================================
    function startLeadFlow() {
        leadFlow.active = true;
        leadFlow.step = 1;
        leadFlow.data = { name: '', phone: '', email: '', interest: '' };
    }

    function processLeadStep(text) {
        const trimmed = text.trim();

        // Allow cancel
        if (/^(cancel|huy|stop|skip|no|khong)$/i.test(trimmed)) {
            leadFlow.active = false;
            leadFlow.step = 0;
            return "No problem! You can type 'register' anytime if you change your mind.";
        }

        switch (leadFlow.step) {
            case 1: // Collecting name
                leadFlow.data.name = trimmed;
                leadFlow.step = 2;
                return `Nice to meet you, <strong>${trimmed}</strong>!\n\nPlease share your <strong>email</strong> or <strong>phone number</strong> so we can reach you:`;

            case 2: // Collecting email/phone
                // Detect if it's email or phone
                const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                const phonePattern = /[\d\s\-+().]{7,}/;

                const emailMatch = trimmed.match(emailPattern);
                const phoneMatch = trimmed.match(phonePattern);

                if (emailMatch) {
                    leadFlow.data.email = emailMatch[0];
                }
                if (phoneMatch) {
                    leadFlow.data.phone = phoneMatch[0].replace(/\s/g, '');
                }

                if (!leadMatch(leadFlow.data)) {
                    return "Hmm, I couldn't detect an email or phone number. Could you please enter a valid <strong>email</strong> (e.g. name@example.com) or <strong>phone number</strong>?";
                }

                leadFlow.step = 3;
                return `Got it! One last question — what are you most interested in?\n\n<strong>1.</strong> Productivity & Focus tools\n<strong>2.</strong> Team time management\n<strong>3.</strong> Pomodoro for studying\n<strong>4.</strong> Just exploring\n\nType a number or describe your interest:`;

            case 3: // Collecting interest
                const interests = {
                    '1': 'Productivity & Focus tools',
                    '2': 'Team time management',
                    '3': 'Pomodoro for studying',
                    '4': 'Just exploring'
                };
                leadFlow.data.interest = interests[trimmed] || trimmed;
                leadFlow.active = false;
                leadFlow.step = 0;

                // Save lead
                saveLead(leadFlow.data);

                const name = leadFlow.data.name;
                return `Thank you, <strong>${name}</strong>! Your information has been saved successfully.\n\nHere's a summary:\n- Name: <strong>${leadFlow.data.name}</strong>\n- ${leadFlow.data.email ? 'Email: <strong>' + leadFlow.data.email + '</strong>' : 'Phone: <strong>' + leadFlow.data.phone + '</strong>'}\n- Interest: <strong>${leadFlow.data.interest}</strong>\n\nWe'll get back to you soon! In the meantime, feel free to try all our timer features.`;

            default:
                leadFlow.active = false;
                return null;
        }
    }

    function leadMatch(data) {
        return data.email || data.phone;
    }

    function saveLead(data) {
        const lead = {
            ...data,
            timestamp: new Date().toLocaleString('vi-VN'),
            source: window.location.href,
            sessionId: SESSION_ID
        };

        // Save to localStorage
        collectedLeads.push(lead);
        localStorage.setItem('timerPro_leads', JSON.stringify(collectedLeads));
        console.log('Lead saved locally:', lead);

        // Build chat history text
        const historyText = chatHistory.map(msg => {
            return `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.text}`;
        }).join('\n\n');

        // Send to Google Sheets
        sendLeadToGoogleSheets(lead, historyText);
    }

    async function sendLeadToGoogleSheets(leadData, chatHistoryText) {
        if (GOOGLE_SCRIPT_URL.includes('YOUR_DEPLOY_ID')) {
            console.log('Google Sheets URL not configured. Lead saved locally only:', leadData);
            return;
        }

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: leadData.name || '',
                    phone: leadData.phone || '',
                    email: leadData.email || '',
                    interest: leadData.interest || '',
                    source: leadData.source || window.location.href,
                    sessionId: SESSION_ID,
                    chatHistory: chatHistoryText,
                    timestamp: leadData.timestamp || new Date().toLocaleString('vi-VN')
                })
            });
            console.log('Lead synced to Google Sheets!');
        } catch (err) {
            console.warn('Could not send lead to Google Sheets:', err);
        }
    }

    // =============================================
    // FALLBACK RESPONSES
    // =============================================
    const fallbackResponses = [
        "I'm not sure about that, but I can help with timers! Try: 'start stopwatch', 'set countdown 5 minutes', or 'start pomodoro'.",
        "Hmm, I didn't understand that. I'm best at managing timers. Type 'help' to see what I can do!",
        "I specialize in timer controls and productivity tips. Try asking 'What can you do?' for a full list of commands.",
        "That's outside my expertise, but I know all about timers! Type 'help' for commands or ask for a 'productivity tip'."
    ];

    // =============================================
    // HELPER FUNCTIONS
    // =============================================
    function switchMode(mode) {
        const tab = document.querySelector(`.mode-tab[data-mode="${mode}"]`);
        if (tab) tab.click();
    }

    function formatCountdownDisplay(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        let parts = [];
        if (h > 0) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
        if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
        if (s > 0) parts.push(`${s} second${s > 1 ? 's' : ''}`);
        return parts.join(' ') || '0 seconds';
    }

    function processMessage(text) {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Track chat history
        chatHistory.push({ role: 'user', text: trimmed });

        // If in lead collection flow, handle that first
        if (leadFlow.active) {
            const response = processLeadStep(trimmed);
            if (response) {
                chatHistory.push({ role: 'bot', text: response });
                return response;
            }
        }

        // Normal command processing
        for (const cmd of commands) {
            for (const pattern of cmd.patterns) {
                const match = trimmed.match(pattern);
                if (match) {
                    const response = cmd.action(match);
                    chatHistory.push({ role: 'bot', text: response });
                    return response;
                }
            }
        }

        const fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        chatHistory.push({ role: 'bot', text: fallback });
        return fallback;
    }

    function addMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `chat-msg ${type}`;
        msg.innerHTML = `<div class="chat-msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
        messagesContainer.appendChild(msg);
        scrollToBottom();
    }

    function showTyping() {
        const typing = document.createElement('div');
        typing.className = 'chat-msg bot';
        typing.id = 'chat-typing-indicator';
        typing.innerHTML = `
            <div class="chat-msg-bubble chat-typing">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>`;
        messagesContainer.appendChild(typing);
        scrollToBottom();
    }

    function hideTyping() {
        const typing = document.getElementById('chat-typing-indicator');
        if (typing) typing.remove();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        chatInput.value = '';

        showTyping();

        const delay = 400 + Math.random() * 600;
        setTimeout(() => {
            hideTyping();
            const response = processMessage(text);
            if (response) addMessage(response, 'bot');
        }, delay);
    }

    // =============================================
    // TOGGLE CHAT WINDOW
    // =============================================
    function toggleChat() {
        const isOpen = chatWindow.classList.contains('open');
        if (isOpen) {
            chatWindow.classList.remove('open');
            fab.classList.remove('open');
        } else {
            chatWindow.classList.add('open');
            fab.classList.add('open');
            chatInput.focus();
            scrollToBottom();
        }
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================
    fab.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    sendBtn.addEventListener('click', handleSend);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
        // Prevent keyboard shortcuts from triggering timer controls
        e.stopPropagation();
    });

    // Prevent chat input key events from bubbling to the main app
    chatInput.addEventListener('keyup', (e) => e.stopPropagation());

    // Quick action buttons
    document.querySelectorAll('.chat-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.dataset.msg;
            if (msg) {
                addMessage(msg, 'user');
                showTyping();
                const delay = 400 + Math.random() * 600;
                setTimeout(() => {
                    hideTyping();
                    const response = processMessage(msg);
                    if (response) addMessage(response, 'bot');
                }, delay);
            }
        });
    });

    // Close chat on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && chatWindow.classList.contains('open')) {
            toggleChat();
        }
    });

})();
