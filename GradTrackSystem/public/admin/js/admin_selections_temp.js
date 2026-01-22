
// Load Selections Page
async function loadSelectionsPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>📋 اختيارات الطلاب للمشاريع</h2>
            <div style="margin-top: 20px;">
                <div style="text-align: center; padding: 40px;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p>جاري تحميل الاختيارات...</p>
                </div>
            </div>
        </div>
    `;

    try {
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const projectsSnapshot = await getDocs(collection(db, "projects"));

        // Build Projects Map: ID -> Title
        const projectsMap = {};
        projectsSnapshot.forEach(doc => {
            projectsMap[doc.id] = doc.data().title || 'مشروع غير معروف';
        });

        let html = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📋 اختيارات الطلاب للمشاريع</h2>
                    <div class="search-box" style="position: relative; width: 300px;">
                        <input type="text" id="searchSelection" placeholder="بحث عن فريق أو مشروع..." 
                            style="width: 100%; padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Cairo';">
                    </div>
                </div>

                <div class="table-container" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #eee;">
                                <th style="padding: 15px; text-align: center; color: #4a5568; width: 50px;">#</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">اسم الفريق</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">كود الفريق</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">المشاريع المختارة (بالأولوية)</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">عدد الرغبات</th>
                            </tr>
                        </thead>
                        <tbody id="selectionsTableBody">
        `;

        let hasData = false;
        let counter = 1;

        if (teamsSnapshot.empty) {
            html += `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #718096;">لا توجد فرق حالياً</td></tr>`;
        } else {
            teamsSnapshot.forEach(teamDoc => {
                const team = teamDoc.data();
                const selectedProjects = team.selectedProjects || [];

                if (selectedProjects.length > 0) {
                    hasData = true;

                    // Map IDs to titles
                    const projectTitles = selectedProjects.map((pid, index) => {
                        const title = projectsMap[pid] || 'مشروع محذوف';
                        return `<div style="margin-bottom:4px; font-size:0.9em;">
                                    <span style="font-weight:bold; color:#667eea;">${index + 1}.</span> ${title}
                                </div>`;
                    }).join('');

                    html += `
                        <tr style="border-bottom: 1px solid #edf2f7; transition: background 0.2s;">
                            <td style="padding: 15px; text-align: center; font-weight: bold; color: #718096;">${counter++}</td>
                            <td style="padding: 15px; font-weight: 600; color: #2d3748;">${team.name || '---'}</td>
                            <td style="padding: 15px; font-family: monospace; color: #718096;">${teamDoc.id}</td>
                            <td style="padding: 15px;">${projectTitles}</td>
                            <td style="padding: 15px; text-align: center;">
                                <span style="background: #e2e8f0; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold;">${selectedProjects.length}</span>
                            </td>
                        </tr>
                    `;
                }
            });
        }

        if (!hasData) {
            html += `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #718096;">لم يقم أي فريق باختيار مشاريع بعد</td></tr>`;
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        contentArea.innerHTML = html;

        // Search
        document.getElementById('searchSelection').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#selectionsTableBody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });

    } catch (error) {
        console.error("Error loading selections:", error);
        contentArea.innerHTML = `<div style="padding: 20px; color: red;">❌ خطأ: ${error.message}</div>`;
    }
}
