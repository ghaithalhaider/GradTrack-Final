/**
 * ui-components.js
 * Shared UI components for Toasts and Modals.
 * Injects its own CSS for portability.
 */

// 1. Inject CSS
(function injectStyles() {
    const styleId = 'ui-components-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Toast Container */
        #toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none; /* Allow clicking through container */
        }

        /* Toast Notification */
        .toast {
            min-width: 300px;
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 15px;
            animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            border-right: 6px solid;
            font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            pointer-events: auto;
            direction: rtl;
        }

        .toast.success { border-color: #48bb78; background: #f0fff4; }
        .toast.error { border-color: #f56565; background: #fff5f5; }
        .toast.info { border-color: #4299e1; background: #ebf8ff; }
        .toast.warning { border-color: #ed8936; background: #fffaf0; }

        .toast-icon { font-size: 1.5em; }
        .toast-message { color: #2d3748; font-weight: 600; font-size: 1em; }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            to { opacity: 0; transform: translateY(20px); }
        }

        /* Modal Overlay */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(5px);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.3s ease-out;
            direction: rtl;
        }

        /* Modal Content */
        .custom-modal {
            background: white;
            width: 90%;
            max-width: 450px;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
            font-family: 'Cairo', 'Segoe UI', sans-serif;
            border: 1px solid rgba(255,255,255,0.8);
        }

        .modal-title {
            font-size: 1.4em;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 10px;
        }

        .modal-message {
            color: #718096;
            margin-bottom: 25px;
            font-size: 1em;
            line-height: 1.6;
        }

        .modal-input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            margin-bottom: 25px;
            font-size: 1.1em;
            outline: none;
            transition: all 0.2s;
            text-align: right;
        }

        .modal-input:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .modal-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
        }

        .btn-modal {
            padding: 12px 30px;
            border-radius: 50px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            font-family: inherit;
            transition: transform 0.1s, box-shadow 0.2s;
            font-size: 1em;
        }

        .btn-modal:active { transform: scale(0.95); }

        .btn-cancel {
            background: #edf2f7;
            color: #4a5568;
        }
        .btn-cancel:hover { background: #e2e8f0; }

        .btn-confirm {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-confirm:hover {
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            transform: translateY(-2px);
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(style);
})();


// 2. Toast Logic
window.showToast = function (message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container); // Append to body, not just anywhere
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Choose icon
    const icons = {
        success: '🎉',
        error: '❌',
        info: '📢',
        warning: '⚠️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || '✨'}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s ease-in forwards';
        setTimeout(() => toast.remove(), 400); // Wait for animation
    }, 4000);
};

// 3. Prompt Modal Logic
// Returns a Promise that resolves to the input value (string) or null if cancelled.
window.showPromptModal = function (title, message, placeholder = '') {
    return new Promise((resolve) => {
        // Create elements
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="custom-modal">
                <div class="modal-title">${title}</div>
                <div class="modal-message">${message}</div>
                <input type="text" class="modal-input" placeholder="${placeholder}" id="modalPromptInput" autocomplete="off">
                <div class="modal-buttons">
                    <button class="btn-modal btn-cancel" id="modalCancelBtn">إلغاء</button>
                    <button class="btn-modal btn-confirm" id="modalConfirmBtn">إرسال</button>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#modalPromptInput');
        const confirmBtn = overlay.querySelector('#modalConfirmBtn');
        const cancelBtn = overlay.querySelector('#modalCancelBtn');

        // Focus input
        setTimeout(() => input.focus(), 100);

        // Close Handler
        const close = (value) => {
            overlay.style.animation = 'fadeOut 0.2s ease-out forwards';
            overlay.querySelector('.custom-modal').style.animation = 'fadeOut 0.2s ease-out forwards'; // Animate content too
            setTimeout(() => overlay.remove(), 200);
            resolve(value);
        };

        // Events
        confirmBtn.onclick = () => close(input.value);
        cancelBtn.onclick = () => close(null);

        // Keyboard Support
        input.onkeyup = (e) => {
            if (e.key === 'Enter') close(input.value);
            if (e.key === 'Escape') close(null);
        };

        // Click Outside
        overlay.onclick = (e) => {
            if (e.target === overlay) close(null);
        }
    });
};

// 4. Confirm Modal Logic
// Returns a Promise that resolves to true (Confirmed) or false (Cancelled).
window.showConfirmModal = function (title, message) {
    return new Promise((resolve) => {
        // Create elements
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="custom-modal">
                <div class="modal-title">${title}</div>
                <div class="modal-message">${message}</div>
                <div class="modal-buttons">
                    <button class="btn-modal btn-cancel" id="modalCancelBtn">إلغاء</button>
                    <button class="btn-modal btn-confirm" id="modalConfirmBtn">نعم، موافق</button>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(overlay);

        const confirmBtn = overlay.querySelector('#modalConfirmBtn');
        const cancelBtn = overlay.querySelector('#modalCancelBtn');

        // Close Handler
        const close = (value) => {
            overlay.style.animation = 'fadeOut 0.2s ease-out forwards';
            overlay.querySelector('.custom-modal').style.animation = 'fadeOut 0.2s ease-out forwards';
            setTimeout(() => overlay.remove(), 200);
            resolve(value);
        };

        // Events
        confirmBtn.onclick = () => close(true);
        cancelBtn.onclick = () => close(false);

        // Keyboard Support (Enter=Confirm, Esc=Cancel)
        document.onkeyup = (e) => {
            if (overlay.isConnected) { // Only if this modal is active
                if (e.key === 'Enter') close(true);
                if (e.key === 'Escape') close(false);
            }
        };

        // Click Outside
        overlay.onclick = (e) => {
            if (e.target === overlay) close(false);
        }
    });
};
