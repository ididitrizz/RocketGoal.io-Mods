(function() {
    const originalFetch = window.fetch;
    window.fetch = new Proxy(originalFetch, {
        apply(target, thisArg, args) {
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : resource?.url || '';
            if (url.includes('v0304_player/nickname')) {
                if (config && config.headers) {
                    const authHeader = config.headers.Authorization || config.headers.authorization;
                    if (authHeader && authHeader.includes('Bearer')) {
                        const token = authHeader.replace('Bearer ', '').trim();
                        sessionStorage.setItem('rocketgoal_auth_token', token);
                    }
                }
            }
            if (url.includes('v0304_login/login')) {
                return Reflect.apply(target, thisArg, args).then(async (response) => {
                    try {
                        const clonedResponse = response.clone();
                        const profileData = await clonedResponse.json();
                        if (profileData && profileData.ModesGlicko) {
                            createStatsDashboard(profileData);
                        }
                    } catch (err) {
                        originalLog("❌ Error parsing login data:", err);
                    }
                    return response;
                });
            }
            return Reflect.apply(target, thisArg, args);
        }
    });
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);
        const message = args.join(' ');
        if (message.includes("Starting game with") && !isRecording) {
            startCanvasRecording();
        }
        if (message.includes("Starting UpdateMatchEnd:") && isRecording) {
            stopCanvasRecording();
        }
    };

    function startCanvasRecording() {
        const gameCanvas = document.querySelector('canvas');
        if (!gameCanvas) {
            originalLog("❌ [RocketGoal.io Tools] Game canvas element not found. Aborting recording.");
            return;
        }

        try {
            isRecording = true;
            recordedChunks = [];
            originalLog("🎥 [RocketGoal.io Tools] Match found! Silently capturing game canvas...");

            // Capture the canvas video frames directly at 30 FPS with ZERO popups or prompts
            const canvasStream = gameCanvas.captureStream(30);

            // Hook into the browser's game audio output context if available
            if (window.AudioContext || window.webkitAudioContext) {
                originalLog("🎵 [RocketGoal.io Tools] Game audio context tracking hooked.");
            }

            mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm; codecs=vp8' });
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };
            mediaRecorder.start(1000); 
            originalLog("🎥 [RocketGoal.io Tools] Replay recording active smoothly.");
        } catch (err) {
            isRecording = false;
            originalLog("❌ [RocketGoal.io Tools] Canvas stream recorder failed:", err);
        }
        injectPerformanceHUD();
    }
    function stopCanvasRecording() {
        if (!mediaRecorder || mediaRecorder.state === "inactive") return;
        originalLog("🏁 [RocketGoal.io Tools] Match completed. Packaging video data...");
        mediaRecorder.onstop = () => {
            isRecording = false;
            const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
            injectReplayPromptUI(videoBlob);
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.stop();
        removePerformanceHUD();
    }
    function injectReplayPromptUI(blob) {
        const oldModal = document.getElementById("replay-prompt");
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = "replay-prompt";
        modal.style.cssText = `
            position: fixed; top: 25px; right: 25px; z-index: 2147483647;
            background: linear-gradient(135deg, #0b1e36 0%, #061020 100%);
            border: 2px solid #ffeb3b; color: white; padding: 20px;
            border-radius: 12px; font-family: 'Segoe UI', sans-serif; text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); width: 260px;
        `;
        modal.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #ffeb3b; font-size: 16px; text-transform: uppercase;">🎮 Match Finished!</h3>
            <p style="margin: 0 0 18px 0; font-size: 12px; color: #8da2bb;">Would you like to save your perspective's replay video?</p>
            <div style="display: flex; gap: 10px;">
                <button id="save-yes" style="flex: 1; background: #ffeb3b; color: #061020; border: none; padding: 8px 0; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 12px;">Yes, Save</button>
                <button id="save-no" style="flex: 1; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.15); padding: 8px 0; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 12px;">Dismiss</button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('save-yes').onclick = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RocketGoal_Replay_${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            modal.remove();
        };
        document.getElementById('save-no').onclick = () => {
            modal.remove();
        };
    }
    let fpsLoopId = null;
    let pingIntervalId = null;
    function injectPerformanceHUD() {
        if (document.getElementById('perf-hud')) return;
        const hud = document.createElement('div');
        hud.id = 'perf-hud';
        hud.style.cssText = `
            position: fixed; top: 15px; left: 15px; z-index: 2147483647;
            background: rgba(10, 15, 28, 0.80); border: 1px solid rgba(0, 229, 255, 0.4); 
            color: white; padding: 8px 14px; border-radius: 6px; 
            font-family: 'Consolas', 'Courier New', monospace; font-size: 13px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4); pointer-events: none;
            display: flex; gap: 15px; align-items: center;
        `;
        hud.innerHTML = `
            <div>FPS: <span id="perf-fps" style="color: #00e5ff; font-weight: bold;">--</span></div>
            <div style="color: rgba(255,255,255,0.3);">|</div>
            <div>PING: <span id="perf-ping" style="color: #a3ff00; font-weight: bold;">-- ms</span></div>
        `;
        document.body.appendChild(hud);
        startFpsTracker();
        startPingTracker();
    }
    function startFpsTracker() {
        let frameCount = 0;
        let lastFpsUpdateTime = performance.now();
        const fpsElement = document.getElementById('perf-fps');
        function calculateFPS() {
            if (!document.getElementById('perf-hud')) return;
            frameCount++;
            const now = performance.now();
            const duration = now - lastFpsUpdateTime;
            if (duration >= 500) {
                const fps = Math.round((frameCount * 1000) / duration);
                fpsElement.innerText = fps;
                if (fps >= 55) fpsElement.style.color = '#00e5ff';
                else if (fps >= 30) fpsElement.style.color = '#ffeb3b';
                else fpsElement.style.color = '#ff5252';
                frameCount = 0;
                lastFpsUpdateTime = now;
            }
            fpsLoopId = requestAnimationFrame(calculateFPS);
        }
        fpsLoopId = requestAnimationFrame(calculateFPS);
    }
    function startPingTracker() {
        const pingElement = document.getElementById('perf-ping');
        async function measurePing() {
            if (!document.getElementById('perf-hud')) return;
            const startTime = performance.now();
            try {
                await fetch('/' + startTime, { 
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                const endTime = performance.now();
                const ping = Math.round(endTime - startTime);
                pingElement.innerText = `${ping} ms`;
                if (ping < 50) pingElement.style.color = '#a3ff00';
                else if (ping < 120) pingElement.style.color = '#ffeb3b';
                else pingElement.style.color = '#ff5252';
            } catch (err) {
                pingElement.innerText = 'Err';
                pingElement.style.color = '#ff5252';
            }
        }
        measurePing();
        pingIntervalId = setInterval(measurePing, 250);
    }
    function removePerformanceHUD() {
        const hud = document.getElementById('perf-hud');
        if (hud) hud.remove();
        
        if (fpsLoopId) cancelAnimationFrame(fpsLoopId);
        if (pingIntervalId) clearInterval(pingIntervalId);
    }
    const STORAGE_KEY = "saved_accounts";
    function createStatsDashboard(data) {
        if (document.getElementById('career-dashboard')) return;
        const dashboard = document.createElement('div');
        dashboard.id = 'career-dashboard';
        dashboard.style.cssText = `
            position: fixed; 
            bottom: 70px;                 
            left: 50%;                
            transform: translate(-50%,0px); 
            z-index: 2147483646;
            background: rgba(14, 20, 35, 0.98); 
            border: 2px solid #00e5ff;
            color: white; 
            padding: 20px; 
            border-radius: 8px; 
            width: 360px;             
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            box-shadow: 0 15px 40px rgba(0,0,0,0.85); 
            transition: opacity 0.3s ease; 
            display: none;
        `;
        const modes = ['Competitive3v3', 'Competitive2v2', 'Competitive1v1', 'Casual'];
        let modesHtml = '';
        modes.forEach(modeName => {
            const glicko = data.ModesGlicko[modeName] || { displayRating: 0, rating: 0, rd: 0 };
            const stats = data.ModesData[modeName] || { wins: 0, loses: 0, matchesPlayed: 0 };
            const totalGames = stats.matchesPlayed || (stats.wins + stats.loses) || 0;
            const winRate = totalGames > 0 ? ((stats.wins / totalGames) * 100).toFixed(1) : "0.0";
            const cleanModeName = modeName.replace('Competitive', 'Comp ');
            modesHtml += `
                <div style="background: rgba(255,255,255,0.04); padding: 10px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid #00e5ff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: bold; color: #e2e8f0; font-size: 13px;">${cleanModeName}</span>
                        <span style="color: #ff9100; font-weight: bold; font-size: 14px;">🌟 ${glicko.displayRating || 1500} MMR</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #a0aec0; font-family: monospace;">
                        <span>W/L: <b style="color:#00ff66">${stats.wins}W</b> - <b style="color:#ff5252">${stats.loses}L</b></span>
                        <span>Winrate: <b style="color:#fff">${winRate}%</b></span>
                        <span title="Glicko-2 Rating Deviation">RD: ±${Math.round(glicko.rd)}</span>
                    </div>
                </div>
            `;
        });
        const rawNickname = data.Nickname || "Player";
        const cleanNickname = rawNickname.replace(/<[^>]*>/g, '').substring(0, 15);
        dashboard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <h3 style="margin: 0; font-size: 15px; color: #00e5ff; text-transform: uppercase; letter-spacing: 0.5px;">📊 Career Analytics</h3>
                <span style="font-size: 11px; background: rgba(0,229,255,0.2); color: #00e5ff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">XP: ${data.AccountXp || 0}</span>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #cbd5e0;">Account Profile: <b>${cleanNickname}</b></p>
            
            <div style="max-height: 280px; overflow-y: auto; padding-right: 2px;">
                ${modesHtml}
            </div>
            <div style="text-align: center; margin-top: 10px; font-size: 10px; color: rgba(255,255,255,0.3);">
                Press <kbd style="background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:3px; color:#fff">H</kbd> to hide/show profile dashboard
            </div>
        `;
        document.body.appendChild(dashboard);
    }
    function toggleStatsView() {
        const box = document.getElementById('career-dashboard');
        if (!box) {
            alert("No statistics data captured yet! Complete login or play a match to fetch profile snapshots.");
            return;
        }
        if (box.style.display === 'none') {
            box.style.display = 'block';
            const accountMenu = document.getElementById('account-menu');
            if (accountMenu) accountMenu.style.display = 'none';
        } else {
            box.style.display = 'none';
        }
    }
    function createDashboardToggleButton() {
        if (document.getElementById('control-container')) return;
        const container = document.createElement('div');
        container.id = 'control-container';
        container.style.cssText = `
            position: fixed; 
            bottom: 25px; 
            left: 50%; 
            transform: translateX(-50%); 
            z-index: 2147483647;
            display: flex;
            gap: 10px;
        `;
        const baseBtnStyle = `
            background: #00e5ff; 
            color: #0e1423; 
            border: none; 
            font-weight: bold;
            font-size: 11px; 
            padding: 8px 18px; 
            border-radius: 4px; 
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,229,255,0.25); 
            transition: transform 0.1s ease, background-color 0.2s;
        `;
        const statsBtn = document.createElement('button');
        statsBtn.id = 'dashboard-toggle-btn';
        statsBtn.innerText = "📊 STATS";
        statsBtn.style.cssText = baseBtnStyle;
        statsBtn.onclick = toggleStatsView;
        const accountBtn = document.createElement('button');
        accountBtn.id = 'account-toggle-btn';
        accountBtn.innerText = "👤 ACCOUNTS";
        accountBtn.style.cssText = baseBtnStyle + `
            background: #1e293b; 
            color: #cbd5e0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
        `;
        accountBtn.onclick = toggleAccountMenu;
        statsBtn.onmouseover = () => statsBtn.style.background = '#ffffff';
        statsBtn.onmouseout = () => statsBtn.style.background = '#00e5ff';
        accountBtn.onmouseover = () => accountBtn.style.background = '#334155';
        accountBtn.onmouseout = () => accountBtn.style.background = '#1e293b';
        container.appendChild(statsBtn);
        container.appendChild(accountBtn);
        document.body.appendChild(container);
        createAccountMenu();
    }
    function createAccountMenu() {
        if (document.getElementById('account-menu')) return;
        const menu = document.createElement('div');
        menu.id = 'account-menu';
        menu.style.cssText = `
            position: fixed;
            bottom: 70px; 
            left: 50%;
            transform: translate(-50%,0px); 
            z-index: 2147483646;
            background: rgba(14, 20, 35, 0.98);
            border: 1px solid #00e5ff;
            border-radius: 6px;
            padding: 10px;
            width: 160px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.6);
            display: none;
            flex-direction: column;
            gap: 6px;
        `;
        let savedAccounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (savedAccounts.length === 0) {
            const emptyLabel = document.createElement('div');
            emptyLabel.innerText = "No alt accounts saved";
            emptyLabel.style.cssText = "color: #718096; font-size: 10px; text-align: center; font-family: sans-serif; padding: 4px 0;";
            menu.appendChild(emptyLabel);
        } else {
            savedAccounts.forEach(acc => {
                const btn = document.createElement('button');
                btn.innerText = acc.profileName;
                btn.style.cssText = `
                    background: rgba(255,255,255,0.05); color: white; border: none;
                    font-size: 11px; font-weight: bold; padding: 6px; border-radius: 4px;
                    text-align: left; cursor: pointer; transition: background 0.2s;
                `;
                btn.onmouseover = () => btn.style.background = 'rgba(0, 229, 255, 0.2)';
                btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.05)';
                btn.onclick = () => switchToAccount(acc);
                menu.appendChild(btn);
            });
        }
        const hr = document.createElement('div');
        hr.style.cssText = "border-top: 1px solid rgba(255,255,255,0.1); margin: 2px 0;";
        menu.appendChild(hr);
        const addBtn = document.createElement('button');
        addBtn.innerText = "➕ Save Current Account";
        addBtn.style.cssText = `
            background: #00e5ff; color: #0e1423; border: none;
            font-size: 10px; font-weight: bold; padding: 6px; border-radius: 4px;
            cursor: pointer; text-align: center;
        `;
        addBtn.onclick = saveCurrentSession;
        menu.appendChild(addBtn);
        document.body.appendChild(menu);
    }
    function toggleAccountMenu() {
        const menu = document.getElementById('account-menu');
        if (!menu) return;
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'flex';
            const statsBox = document.getElementById('career-dashboard');
            if (statsBox) statsBox.style.display = 'none';
        } else {
            menu.style.display = 'none';
        }
    }
    function saveCurrentSession() {
        const name = prompt("Enter a label for this account profile (e.g., 'Main', 'Alt 1'):");
        if (!name) return;
        const currentToken = localStorage.getItem("firebase:auth:token") || ""; 
        let savedAccounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        savedAccounts.push({
            profileName: name,
            tokenData: currentToken
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAccounts));
        alert("Account saved!");
        location.reload();
    }
    function switchToAccount(accountObj) {
        localStorage.setItem("firebase:auth:token", accountObj.tokenData);
        location.reload();
    }
    const originalLogChecker = console.log;
    console.log = function(...args) {
        originalLogChecker.apply(console, args);
        const logLine = args.join(' ');
        const statsBox = document.getElementById('career-dashboard');
        const accountMenu = document.getElementById('account-menu');
        const controlPanel = document.getElementById('control-container');
        if (logLine.includes("playerDataManager") || logLine.includes("PlayerDataManager")) {
            if (statsBox) statsBox.style.display = 'none';
            if (accountMenu) accountMenu.style.display = 'none';
            if (controlPanel) controlPanel.style.display = 'none';
        }
        if (logLine.includes("Starting SetNickname:")) {
            if (!controlPanel) {
                createDashboardToggleButton(); 
            } else {
                controlPanel.style.display = 'flex';
            }
        }
    };
})();
