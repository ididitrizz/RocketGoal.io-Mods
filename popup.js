const nameInput = document.getElementById('input-name');
const previewDiv = document.getElementById('preview-name');
const statusDiv = document.getElementById('status');
const colorDropdown = document.getElementById('select-color');
const colorPicker = document.getElementById('picker-color');

let savedTemplates = JSON.parse(localStorage.getItem('rocketgoal_templates') || '{}');
updateTemplatesList();

// ===== PREVIEW SYSTEM =====
function updatePreview() {
    let html = nameInput.value;
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
    html = html.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b style="font-weight: bold;">$1</b>')
               .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i style="font-style: italic;">$1</i>')
               .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u style="text-decoration: underline;">$1</u>');
    const innerColorRegex = /&lt;color=([^&>]+)&gt;((?:(?!&lt;color=)(?!&lt;\/color&gt;).)*?)&lt;\/color&gt;/gi;
    let oldHtml;
    do {
        oldHtml = html;
        html = html.replace(innerColorRegex, '<span style="color: $1;">$2</span>');
    } while (html !== oldHtml);
    let unclosedRegex = /&lt;color=([^&>]+)&gt;/gi;
    let match;
    while ((match = unclosedRegex.exec(html)) !== null) {
        const colorValue = match[1];
        const startPos = match.index;
        const beforeTag = html.substring(0, startPos);
        const afterTag = html.substring(startPos + match[0].length);
        html = beforeTag + '<span style="color: ' + colorValue + ';">' + afterTag + '</span>';
        unclosedRegex.lastIndex = 0;
    }
    previewDiv.innerHTML = html;
}

nameInput.addEventListener('input', updatePreview);

// ===== TEXT WRAPPING FUNCTION =====
function wrapText(openTag, closeTag) {
    const start = nameInput.selectionStart;
    const end = nameInput.selectionEnd;
    const text = nameInput.value;
    const selectedText = text.substring(start, end);
    const replacement = openTag + selectedText + closeTag;
    nameInput.value = text.substring(0, start) + replacement + text.substring(end);
    nameInput.focus();
    nameInput.setSelectionRange(start + openTag.length, start + openTag.length + selectedText.length);
    updatePreview();
}

// ===== FORMATTING BUTTONS =====
document.getElementById('btn-bold').addEventListener('click', () => {
    wrapText('<b>', '</b>');
});

document.getElementById('btn-italic').addEventListener('click', () => {
    wrapText('<i>', '</i>');
});

document.getElementById('btn-underline').addEventListener('click', () => {
    wrapText('<u>', '</u>');
});

// ===== COLOR SELECTOR =====
let pickerCheckInterval = null;

colorDropdown.addEventListener('change', (e) => {
    const selectedValue = e.target.value.toLowerCase().trim();
    if (selectedValue === 'custom') {
        colorPicker.style.pointerEvents = 'auto';
        colorPicker.click();
        clearInterval(pickerCheckInterval);
        pickerCheckInterval = setInterval(() => {
            if (document.activeElement !== colorPicker) {
                cleanUpColorPicker();
            }
        }, 400);

    } else if (selectedValue) {
        applyColorFormatting(`<color=${selectedValue}>`, '</color>');
        colorDropdown.value = ""; 
    }
});

colorPicker.addEventListener('input', (e) => {
    applyColorFormatting(`<color=${e.target.value}>`, '</color>');
});

colorPicker.addEventListener('change', () => {
    cleanUpColorPicker();
});

function cleanUpColorPicker() {
    clearInterval(pickerCheckInterval); 
    colorPicker.style.pointerEvents = 'none'; 
    colorDropdown.value = "";                 
    if (nameInput) {
        nameInput.focus(); 
    }
}

function applyColorFormatting(openTag, closeTag) {
    const text = nameInput.value;
    const start = nameInput.selectionStart;
    const end = nameInput.selectionEnd;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + openTag + selectedText + closeTag + text.substring(end);
    nameInput.value = newText;
    const newCursorPos = start + openTag.length + selectedText.length + closeTag.length;
    nameInput.focus();
    nameInput.setSelectionRange(newCursorPos, newCursorPos);
    updatePreview();
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            wrapText('<b>', '</b>');
        } else if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            wrapText('<i>', '</i>');
        } else if (e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            wrapText('<u>', '</u>');
        }
    }
});

// ===== TEMPLATES SYSTEM =====
function updateTemplatesList() {
    const select = document.getElementById('templates-select');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected hidden>📥 Load Template</option>';
    Object.keys(savedTemplates).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
}

document.getElementById('templates-select').addEventListener('change', (e) => {
    if (e.target.value) {
        nameInput.value = savedTemplates[e.target.value];
        updatePreview();
        e.target.value = "";
    }
});

document.getElementById('btn-save-template').addEventListener('click', () => {
    if (!nameInput.value.trim()) {
        showStatus('Enter a nickname first!', 'error');
        return;
    }
    const name = prompt('Template name (e.g., "Blue Bold", "Party Mode"):');
    if (name) {
        if (name.trim() === '') {
            showStatus('Template name cannot be empty!', 'error');
            return;
        }
        savedTemplates[name] = nameInput.value;
        localStorage.setItem('rocketgoal_templates', JSON.stringify(savedTemplates));
        updateTemplatesList();
        showStatus(`Template "${name}" saved! 💾`, 'success');
    }
});

// ===== STATUS MESSAGES =====
function showStatus(message, type = 'info') {
    statusDiv.className = type;
    statusDiv.textContent = message;
    if (type !== 'processing') {
        setTimeout(() => {
            statusDiv.className = '';
        }, 4000);
    }
}

// ===== SEND NICKNAME =====
document.getElementById('btn-send').addEventListener('click', async () => {
    const targetName = nameInput.value.trim();
    if (!targetName) {
        showStatus('Please enter a nickname!', 'error');
        return;
    }
    showStatus('Processing...', 'info');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        showStatus('Error: No active tab found.', 'error');
        return;
    }
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: performNameChangeUpdate,
        args: [targetName]
    }, (results) => {
        if (chrome.runtime.lastError) {
            showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        } else if (results && results[0] && results[0].result) {
            const res = results[0].result;
            if (res.success) {
                showStatus('Success! Reloading game...', 'success');
                setTimeout(() => {
                    chrome.tabs.reload(tab.id);
                }, 1000);
            } else {
                showStatus('Failed: ' + res.error, 'error');
            }
        }
    });
});

// ===== CORE NAME CHANGE FUNCTION =====
async function performNameChangeUpdate(newName) {
    try {
        let token = null;
        token = sessionStorage.getItem('rocketgoal_auth_token');
        if (!token) {
            return { success: false, error: "Authorization token not found. Please wait until token is fetched." };
        }
        const endpointUrl = "https://us-central1-rocketball-23c12.cloudfunctions.net/v0304_player/nickname"; 
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                nickname: newName
            })
        });
        if (response.ok) {
            return { success: true };
        } else {
            return { success: false, error: `Server responded with code ${response.status}` };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}
