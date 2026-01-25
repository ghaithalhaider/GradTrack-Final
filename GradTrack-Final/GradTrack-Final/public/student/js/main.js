import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import * as PageLogic from './page.js';

// Expose functions to window for onclick events in HTML
window.dashboardApp = {
    loadPage: (pageName) => {
        console.log("Loading page:", pageName);
        switch (pageName) {
            case 'dashboard':
            case 'home':
                PageLogic.showDashboardHome();
                break;
            case 'create-team':
                PageLogic.loadCreateTeamPage();
                break;
            case 'view-team':
                PageLogic.loadViewTeamPage();
                break;
            case 'current-project':
                PageLogic.showCurrentProjectPage();
                break;
            case 'select-project':
                PageLogic.showProjectSelectionPage();
                break;
            case 'settings-general':
                PageLogic.loadSettingsPage('general');
                break;
            case 'settings-privacy':
                PageLogic.loadSettingsPage('privacy');
                break;
            default:
                PageLogic.showDashboardHome();
        }

        // Update sidebar active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageName) link.classList.add('active');
        });
    },

    // Auth
    logout: () => {
        auth.signOut().then(() => {
            window.location.href = '../loginn/login.html';
        });
    },

    // Bridging Page Logic functions
    teamAddMember: PageLogic.teamAddMember,
    selectAvailableProject: PageLogic.selectAvailableProject,
    selectChosenProject: PageLogic.selectChosenProject,
    moveToSelected: PageLogic.moveToSelected,
    moveToAvailable: PageLogic.moveToAvailable,
    moveUp: PageLogic.moveUp,
    moveDown: PageLogic.moveDown,
    confirmSelection: PageLogic.confirmSelection,
    resetSelection: PageLogic.resetSelection,
    editProject: () => alert("Not implemented yet"),
    goToTasks: () => alert("Not implemented yet"),

    // Notifications
    toggleNotifications: PageLogic.toggleNotifications,
    clearAllNotifications: PageLogic.clearAllNotifications,
    removeNotification: PageLogic.removeNotificationExport,
    markNotificationAsRead: PageLogic.markNotificationAsRead,
    addNotification: PageLogic.addNotification
};

// Global toggleMenu function for dropdowns
window.toggleMenu = function (button) {
    const dropdown = button.nextElementSibling;
    const parent = button.parentElement;

    // Close other dropdowns
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item !== parent) item.classList.remove('active');
    });

    parent.classList.toggle('active');
};

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item')) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // Not logged in, redirect to login
            window.location.href = '../loginn/login.html';
            return;
        }

        // Check email verification
        /* TEMPORARILY DISABLED FOR TESTING
        if (!user.emailVerified) {
            alert('⚠️ يرجى تأكيد بريدك الإلكتروني أولاً');
            window.location.href = '../loginn/email-confirmation.html';
            return;
        }
        */

        // User is authenticated and verified
        // Set current user ID for notifications
        PageLogic.setCurrentUserId(user.uid);

        // Load and setup notifications
        PageLogic.loadNotificationsFromFirebase();
        PageLogic.setupNotificationListener();

        // Initial Load
        PageLogic.showDashboardHome();

        // Logout listener
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', window.dashboardApp.logout);
        }
    });
});
